import { NextRequest, NextResponse } from 'next/server';
import { getAppUserId } from '@/lib/google';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;

export async function GET(req: NextRequest) {
  try {
    const appUserId = getAppUserId(req);
    const { data, error } = await supabaseAdmin
      .from('connected_google_accounts')
      .select('id, google_email, created_at, user_nickname, base_color')
      .eq('app_user_id', appUserId)
      .order('created_at', { ascending: true });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ accounts: data || [] });
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
