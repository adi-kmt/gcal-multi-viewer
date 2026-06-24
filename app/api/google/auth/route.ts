import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { getOAuthClient, GOOGLE_SCOPES } from '@/lib/google';
import { getSessionUser } from '@/lib/session';

export async function GET(req: NextRequest) {
  const oauth2Client = getOAuthClient();
  const state = randomUUID();
  const flow = req.nextUrl.searchParams.get('connect') === '1' && getSessionUser(req)
    ? 'connect'
    : 'signin';

  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: GOOGLE_SCOPES,
    state,
  });

  const response = NextResponse.redirect(url);
  response.cookies.set('google_oauth_state', state, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 10,
    path: '/',
  });
  response.cookies.set('google_oauth_flow', flow, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 10,
    path: '/',
  });
  return response;
}
