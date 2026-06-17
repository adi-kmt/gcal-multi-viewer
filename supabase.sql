create extension if not exists pgcrypto;

create table if not exists rooms (
  id uuid primary key default gen_random_uuid(),
  room_code text not null unique,
  room_name text not null,
  password_hash text not null,
  created_by_app_user_id text not null,
  created_at timestamptz default now()
);

create table if not exists room_members (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references rooms(id) on delete cascade,
  app_user_id text not null,
  nickname text not null,
  base_color text not null,
  created_at timestamptz default now(),
  unique(room_id, app_user_id)
);

create table if not exists connected_google_accounts (
  id uuid primary key default gen_random_uuid(),
  app_user_id text not null,
  google_email text not null,
  refresh_token text not null,
  access_token text,
  expiry_date bigint,
  room_id uuid references rooms(id) on delete set null,
  user_nickname text,
  base_color text,
  created_at timestamptz default now(),
  unique(app_user_id, google_email)
);

create index if not exists connected_google_accounts_app_user_idx
  on connected_google_accounts(app_user_id);

create index if not exists room_members_room_id_idx
  on room_members(room_id);
