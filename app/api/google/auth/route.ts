import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { getOAuthClient, GOOGLE_SCOPES } from '@/lib/google';

export async function GET() {
  const oauth2Client = getOAuthClient();
  const state = randomUUID();

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
  return response;
}
