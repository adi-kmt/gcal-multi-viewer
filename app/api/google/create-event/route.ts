import { google } from 'googleapis';
import { NextRequest, NextResponse } from 'next/server';
import { getAppUserId, getOAuthClient } from '@/lib/google';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { accountId, calendarId = 'primary', title, start, end, attendeeEmails = [] } = body;

    if (!accountId || !title || !start || !end) {
      return NextResponse.json({ error: 'accountId, title, start, and end are required' }, { status: 400 });
    }

    if (Number.isNaN(Date.parse(start)) || Number.isNaN(Date.parse(end)) || Date.parse(start) >= Date.parse(end)) {
      return NextResponse.json({ error: 'start and end must be valid date-times, with end after start' }, { status: 400 });
    }

    if (!Array.isArray(attendeeEmails)) {
      return NextResponse.json({ error: 'attendeeEmails must be an array' }, { status: 400 });
    }

    const validAttendeeEmails = attendeeEmails
      .map((email: unknown) => String(email).trim().toLowerCase())
      .filter(Boolean);

    if (validAttendeeEmails.some((email: string) => !EMAIL_RE.test(email))) {
      return NextResponse.json({ error: 'One or more attendee emails are invalid' }, { status: 400 });
    }

    const appUserId = getAppUserId(req);
    const { data: account, error } = await supabaseAdmin
      .from('connected_google_accounts')
      .select('*')
      .eq('app_user_id', appUserId)
      .eq('id', accountId)
      .single();

    if (error || !account) {
      return NextResponse.json({ error: 'Google account not found' }, { status: 404 });
    }

    const oauth2Client = getOAuthClient();
    oauth2Client.setCredentials({ refresh_token: account.refresh_token });

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    const event = await calendar.events.insert({
      calendarId,
      sendUpdates: validAttendeeEmails.length > 0 ? 'all' : 'none',
      requestBody: {
        summary: String(title).trim(),
        start: { dateTime: start },
        end: { dateTime: end },
        attendees: validAttendeeEmails.length > 0 ? validAttendeeEmails.map((email: string) => ({ email })) : undefined,
        reminders: {
          useDefault: false,
          overrides: [{ method: 'popup', minutes: 30 }],
        },
      },
    });

    return NextResponse.json({ event: event.data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not create Google Calendar event';
    return NextResponse.json({ error: message }, { status: message === 'Not authenticated with Google' ? 401 : 500 });
  }
}
