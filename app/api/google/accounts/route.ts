import { NextRequest, NextResponse } from 'next/server';
import { getAppUserId } from '@/lib/google';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;

export async function GET(req: NextRequest) {
  try {
    const appUserId = getAppUserId(req);
    const roomCode = req.nextUrl.searchParams.get('roomCode')?.trim().toUpperCase();
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

    let query = supabaseAdmin
      .from('connected_google_accounts')
      .select('id, google_email, created_at, user_nickname, base_color, app_user_id')
      .order('created_at', { ascending: true });

    query = roomId ? query.eq('room_id', roomId) : query.eq('app_user_id', appUserId);

    const { data, error } = await query;

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({
      accounts: (data || []).map((account) => ({
        id: account.id,
        google_email: account.google_email,
        created_at: account.created_at,
        user_nickname: account.user_nickname,
        base_color: account.base_color,
        can_disconnect: account.app_user_id === appUserId,
      })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not load Google accounts';
    return NextResponse.json({ error: message }, { status: message === 'Not authenticated with Google' ? 401 : 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const appUserId = getAppUserId(req);
    const { accountId, baseColor } = await req.json();

    if (!accountId || !baseColor || !HEX_COLOR_RE.test(String(baseColor))) {
      return NextResponse.json({ error: 'accountId and a valid baseColor are required' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('connected_google_accounts')
      .update({ base_color: String(baseColor) })
      .eq('app_user_id', appUserId)
      .eq('id', accountId)
      .select('id, google_email, created_at, user_nickname, base_color')
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ account: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not update Google account';
    return NextResponse.json({ error: message }, { status: message === 'Not authenticated with Google' ? 401 : 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const appUserId = getAppUserId(req);
    const { accountId } = await req.json();

    if (!accountId) {
      return NextResponse.json({ error: 'accountId is required' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('connected_google_accounts')
      .delete()
      .eq('app_user_id', appUserId)
      .eq('id', accountId)
      .select('id, google_email')
      .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data) return NextResponse.json({ error: 'Google account not found' }, { status: 404 });

    return NextResponse.json({ account: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not remove Google account';
    return NextResponse.json({ error: message }, { status: message === 'Not authenticated with Google' ? 401 : 500 });
  }
}
