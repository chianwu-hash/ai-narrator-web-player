create table if not exists public.device_activity (
  id uuid primary key default gen_random_uuid(),
  device_hash text not null unique,
  device_kind text not null default 'unknown' check (device_kind in ('mobile', 'tablet', 'desktop', 'unknown')),
  browser_family text not null default 'unknown',
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create index if not exists device_activity_last_seen_at_idx on public.device_activity(last_seen_at desc);
create index if not exists device_activity_device_kind_idx on public.device_activity(device_kind);

alter table public.device_activity enable row level security;
