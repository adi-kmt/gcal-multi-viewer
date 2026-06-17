import { google } from 'googleapis';
import { NextRequest } from 'next/server';
import { getSessionUser } from '@/lib/session';

export const GOOGLE_SCOPES = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/calendar.events',
];

export function getOAuthClient() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error('Missing Google OAuth environment variables');
  }

  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

export function getAppUserId(req: NextRequest) {
  const user = getSessionUser(req);
  if (!user) throw new Error('Not authenticated with Google');

  return user.email.toLowerCase();
}
