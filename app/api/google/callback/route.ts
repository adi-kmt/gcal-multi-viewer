import { google } from 'googleapis';
import { NextRequest, NextResponse } from 'next/server';
import { getOAuthClient } from '@/lib/google';
import { setSessionCookie } from '@/lib/session';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function GET(req: NextRequest) {
  try {
    const code = req.nextUrl.searchParams.get('code');
    const state = req.nextUrl.searchParams.get('state');
    const expectedState = req.cookies.get('google_oauth_state')?.value;

    if (!code) return NextResponse.json({ error: 'Missing code' }, { status: 400 });
    if (!state || !expectedState || state !== expectedState) {
      return NextResponse.json({ error: 'Invalid OAuth state' }, { status: 400 });
    }

    const oauth2Client = getOAuthClient();
    const { tokens } = await oauth2Client.getToken(code);

    if (!tokens.refresh_token) {
      return NextResponse.json(
        { error: 'No refresh token returned. Try removing app access in Google Account settings and reconnect.' },
        { status: 400 },
      );
    }

    oauth2Client.setCredentials(tokens);
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const { data: profile } = await oauth2.userinfo.get();

    if (!profile.email) {
      return NextResponse.json({ error: 'Could not read Google email' }, { status: 400 });
    }

    const response = NextResponse.redirect(new URL('/', req.url));
    setSessionCookie(response, {
      email: profile.email,
      name: profile.name || undefined,
      picture: profile.picture || undefined,
    });

    const { error } = await supabaseAdmin.from('connected_google_accounts').upsert({
      app_user_id: profile.email.toLowerCase(),
      google_email: profile.email,
      refresh_token: tokens.refresh_token,
      access_token: tokens.access_token,
      expiry_date: tokens.expiry_date,
    }, { onConflict: 'app_user_id,google_email' });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    response.cookies.delete('google_oauth_state');
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Google OAuth callback failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
