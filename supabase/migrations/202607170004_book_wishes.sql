create table if not exists public.book_wishes (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 2 and 160),
  author text,
  reason text not null check (char_length(reason) between 4 and 1000),
  status text not null default 'new' check (status in ('new', 'reviewing', 'accepted', 'rejected', 'done')),
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  deleted_at timestamptz
);

create index if not exists book_wishes_created_at_idx on public.book_wishes(created_at desc);
create index if not exists book_wishes_status_idx on public.book_wishes(status);
create index if not exists book_wishes_deleted_at_idx on public.book_wishes(deleted_at);

alter table public.book_wishes enable row level security;
