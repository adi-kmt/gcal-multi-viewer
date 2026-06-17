# Google Multi Account Calendar Viewer

A Next.js starter for room-based multi-person calendar planning. It uses Google OAuth for app identity, connects Google Calendar accounts, pulls Calendar events, shows them in a FullCalendar UI, and can create Google Calendar events with attendee invites.

The room UI supports room name, code, and password entry. Room create/join APIs are backed by Supabase and scoped to the signed-in Google user.

## Setup

1. Create a Google Cloud OAuth Client ID.
2. Add redirect URI:

```txt
http://localhost:3000/api/google/callback
```

3. Create a Supabase project and run `supabase.sql`.
4. Copy `.env.example` to `.env.local` and fill values.
5. Install and run:

```bash
npm install
npm run dev
```

## Notes

The app stores a signed HTTP-only session cookie after Google OAuth. API routes use the Google email from that session as the user partition.

Scopes used:

- `https://www.googleapis.com/auth/calendar.readonly`
- `https://www.googleapis.com/auth/calendar.events`

## Production Readiness

Before public deployment, finish these items:

- Store Google refresh tokens encrypted or in a managed secret store.
- Add row-level security policies if exposing Supabase directly to clients.
- Add integration tests around OAuth callback, event fetch, and event creation.
