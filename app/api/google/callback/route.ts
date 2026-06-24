import { google } from 'googleapis';
import { NextRequest, NextResponse } from 'next/server';
import { getOAuthClient } from '@/lib/google';
import { getSessionUser, setSessionCookie } from '@/lib/session';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

const ACCOUNT_COLOR_PRESETS = ['#B66E90', '#C49A5A', '#6F9D8F', '#7C8FC6', '#B77A62', '#8D75B8'];

function getAccountColor(email: string) {
  let hash = 0;
  for (let i = 0; i < email.length; i++) {
    hash = email.charCodeAt(i) + ((hash << 5) - hash);
  }
  return ACCOUNT_COLOR_PRESETS[Math.abs(hash) % ACCOUNT_COLOR_PRESETS.length];
}

export async function GET(req: NextRequest) {
  try {
    const code = req.nextUrl.searchParams.get('code');
    const state = req.nextUrl.searchParams.get('state');
    const expectedState = req.cookies.get('google_oauth_state')?.value;
    const flow = req.cookies.get('google_oauth_flow')?.value;

    if (!code) return NextResponse.json({ error: 'Missing code' }, { status: 400 });
    if (!state || !expectedState || state !== expectedState) {
      return NextResponse.json({ error: 'Invalid OAuth state' }, { status: 400 });
    }

    const oauth2Client = getOAuthClient();
    const { tokens } = await oauth2Client.getToken(code);

    oauth2Client.setCredentials(tokens);
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const { data: profile } = await oauth2.userinfo.get();

    if (!profile.email) {
      return NextResponse.json({ error: 'Could not read Google email' }, { status: 400 });
    }

    const redirectOrigin = new URL(process.env.GOOGLE_REDIRECT_URI || req.url).origin;
    const response = NextResponse.redirect(new URL('/', redirectOrigin));
    const existingUser = getSessionUser(req);
    const isConnectFlow = flow === 'connect' && existingUser;

    const { data: linkedAccount } = isConnectFlow
      ? { data: null }
      : await supabaseAdmin
        .from('connected_google_accounts')
        .select('app_user_id')
        .eq('google_email', profile.email)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();

    const appUserId = isConnectFlow
      ? existingUser.email.toLowerCase()
      : linkedAccount?.app_user_id || profile.email.toLowerCase();

    const { data: currentAccount } = await supabaseAdmin
      .from('connected_google_accounts')
      .select('refresh_token')
      .eq('app_user_id', appUserId)
      .eq('google_email', profile.email)
      .maybeSingle();

    const refreshToken = tokens.refresh_token || currentAccount?.refresh_token;
    if (!refreshToken) {
      return NextResponse.json(
        { error: 'No refresh token returned. Try removing app access in Google Account settings and reconnect.' },
        { status: 400 },
      );
    }

    if (!isConnectFlow) {
      setSessionCookie(response, {
        email: appUserId,
        name: profile.name || undefined,
        picture: profile.picture || undefined,
      });
    }

    const { data: existingAccount } = await supabaseAdmin
      .from('connected_google_accounts')
      .select('room_id, user_nickname, base_color')
      .eq('app_user_id', appUserId)
      .not('user_nickname', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data: existingMember } = await supabaseAdmin
      .from('room_members')
      .select('room_id, nickname, base_color')
      .eq('app_user_id', appUserId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const { error } = await supabaseAdmin.from('connected_google_accounts').upsert({
      app_user_id: appUserId,
      google_email: profile.email,
      refresh_token: refreshToken,
      access_token: tokens.access_token,
      expiry_date: tokens.expiry_date,
      room_id: existingAccount?.room_id || existingMember?.room_id || null,
      user_nickname: existingAccount?.user_nickname || existingMember?.nickname || null,
      base_color: existingAccount?.base_color || existingMember?.base_color || getAccountColor(profile.email),
    }, { onConflict: 'app_user_id,google_email' });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    response.cookies.delete('google_oauth_state');
    response.cookies.delete('google_oauth_flow');
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Google OAuth callback failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
