create extension if not exists pgcrypto;

create table if not exists public.sync_profiles (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now()
);

create table if not exists public.sync_devices (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.sync_profiles(id) on delete cascade,
  token_hash text not null unique,
  display_name text,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  revoked_at timestamptz
);

create table if not exists public.sync_states (
  profile_id uuid primary key references public.sync_profiles(id) on delete cascade,
  state jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.sync_pairing_codes (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.sync_profiles(id) on delete cascade,
  code_hash text not null,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists sync_devices_profile_id_idx on public.sync_devices(profile_id);
create index if not exists sync_pairing_codes_profile_id_idx on public.sync_pairing_codes(profile_id);
create index if not exists sync_pairing_codes_code_hash_idx on public.sync_pairing_codes(code_hash);
create index if not exists sync_pairing_codes_expires_at_idx on public.sync_pairing_codes(expires_at);

alter table public.sync_profiles enable row level security;
alter table public.sync_devices enable row level security;
alter table public.sync_states enable row level security;
alter table public.sync_pairing_codes enable row level security;
