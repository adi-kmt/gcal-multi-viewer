import { describe, expect, it, beforeEach } from 'vitest';
import { createSessionToken, verifySessionToken } from '../lib/session';

describe('Google OAuth session token', () => {
  beforeEach(() => {
    process.env.SESSION_SECRET = 'fake-test-secret';
  });

  it('round-trips a signed Google user', () => {
    const token = createSessionToken({
      email: 'person@example.com',
      name: 'Fake Person',
    });

    expect(verifySessionToken(token)).toEqual({
      email: 'person@example.com',
      name: 'Fake Person',
    });
  });

  it('rejects a tampered payload', () => {
    const token = createSessionToken({ email: 'person@example.com' });
    const [payload, signature] = token.split('.');
    const tamperedPayload = Buffer
      .from(JSON.stringify({ email: 'attacker@example.com' }), 'utf8')
      .toString('base64url');

    expect(verifySessionToken(`${tamperedPayload}.${signature}`)).toBeNull();
    expect(verifySessionToken(`${payload}.bad-signature`)).toBeNull();
  });
});
