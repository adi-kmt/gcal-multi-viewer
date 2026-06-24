import { calendar_v3, google } from 'googleapis';
import { NextRequest, NextResponse } from 'next/server';
import { getAppUserId, getOAuthClient } from '@/lib/google';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

// Unify Palette (Muted)
const UNIFY_PALETTE = [
  { name: 'WORK', hex: '#5E6E8E' },
  { name: 'PERSONAL', hex: '#6F8C77' },
  { name: 'FAMILY', hex: '#B5915F' },
  { name: 'HEALTH', hex: '#A86F73' },
  { name: 'TRAVEL', hex: '#5F8A8A' },
  { name: 'FOCUS', hex: '#7F7197' },
];

function getHashColor(str: string) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % UNIFY_PALETTE.length;
  return UNIFY_PALETTE[index];
}

export async function GET(req: NextRequest) {
  try {
    const timeMin = req.nextUrl.searchParams.get('timeMin') || new Date().toISOString();
    const timeMax = req.nextUrl.searchParams.get('timeMax') || new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString();
    const accountId = req.nextUrl.searchParams.get('accountId');
    const roomCode = req.nextUrl.searchParams.get('roomCode')?.trim().toUpperCase();

    if (Number.isNaN(Date.parse(timeMin)) || Number.isNaN(Date.parse(timeMax)) || Date.parse(timeMin) >= Date.parse(timeMax)) {
      return NextResponse.json({ error: 'timeMin and timeMax must be valid date-times, with timeMax after timeMin' }, { status: 400 });
    }

    const appUserId = getAppUserId(req);
    let roomId: string | null = null;

    if (roomCode) {
      const { data: room, error: roomError } = await supabaseAdmin
        .from('rooms')
        .select('id')
        .eq('room_code', roomCode)
        .single();

      if (roomError || !room) {
        return NextResponse.json({ error: 'Room not found' }, { status: 404 });
      }

      const { data: member, error: memberError } = await supabaseAdmin
        .from('room_members')
        .select('id')
        .eq('room_id', room.id)
        .eq('app_user_id', appUserId)
        .maybeSingle();

      if (memberError) return NextResponse.json({ error: memberError.message }, { status: 500 });
      if (!member) return NextResponse.json({ error: 'Not a member of this room' }, { status: 403 });

      roomId = room.id;
    }

    let accountQuery = supabaseAdmin
      .from('connected_google_accounts')
      .select('*');

    accountQuery = roomId
      ? accountQuery.eq('room_id', roomId)
      : accountQuery.eq('app_user_id', appUserId);

    if (accountId) {
      accountQuery = accountQuery.eq('id', accountId).eq('app_user_id', appUserId);
    }

    const { data: accounts, error } = await accountQuery;

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const allEvents: calendar_v3.Schema$Event[] = [];
    const skippedCalendars: { accountEmail: string; calendarId: string; message: string }[] = [];

    for (const account of (accounts || [])) {
      const oauth2Client = getOAuthClient();
      oauth2Client.setCredentials({ refresh_token: account.refresh_token });

      const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
      const calendarList = await calendar.calendarList.list();

      for (const cal of calendarList.data.items || []) {
        if (!cal.id || cal.selected === false) continue;

        try {
          const events = await calendar.events.list({
            calendarId: cal.id,
            timeMin,
            timeMax,
            singleEvents: true,
            orderBy: 'startTime',
            maxResults: 250,
          });

          const assignedTheme = account.base_color
            ? { name: 'ACCOUNT', hex: account.base_color }
            : getHashColor(account.google_email);
          const tagName = cal.summary ? cal.summary.substring(0, 8).toUpperCase() : assignedTheme.name;

          for (const event of events.data.items || []) {
            if (!event.id) continue;
            allEvents.push({
              id: `${account.id}:${cal.id}:${event.id}`,
              summary: event.summary || '(No title)',
              start: event.start,
              end: event.end,
              colorId: event.colorId,
              htmlLink: event.htmlLink,
              extendedProperties: {
                private: {
                  backgroundColor: assignedTheme.hex,
                  borderColor: assignedTheme.hex,
                  googleEventId: event.id,
                  accountId: account.id,
                  accountEmail: account.google_email,
                  calendarId: cal.id,
                  calendarName: cal.summary || '',
                  userNickname: account.user_nickname || account.app_user_id,
                  tagName,
                },
              },
            });
          }
        } catch (calendarError) {
          skippedCalendars.push({
            accountEmail: account.google_email,
            calendarId: cal.id,
            message: calendarError instanceof Error ? calendarError.message : 'Calendar fetch failed',
          });
        }
      }
    }

    return NextResponse.json({
      events: allEvents.map((event) => ({
        id: event.id,
        title: event.summary || '(No title)',
        start: event.start?.dateTime || event.start?.date,
        end: event.end?.dateTime || event.end?.date,
        allDay: Boolean(event.start?.date),
        backgroundColor: event.extendedProperties?.private?.backgroundColor,
        borderColor: event.extendedProperties?.private?.borderColor,
        extendedProps: event.extendedProperties?.private,
      })),
      skippedCalendars,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not load Google Calendar events';
    return NextResponse.json({ error: message }, { status: message === 'Not authenticated with Google' ? 401 : 500 });
  }
}
