create table if not exists public.content_comments (
  id uuid primary key default gen_random_uuid(),
  target_type text not null check (target_type in ('book', 'episode')),
  book_id text not null,
  book_title text not null,
  episode_id text,
  episode_title text,
  comment_type text not null check (comment_type in ('reflection', 'error_report', 'other')),
  body text not null check (char_length(body) between 4 and 1000),
  status text not null default 'new' check (status in ('new', 'reviewing', 'resolved', 'ignored')),
  created_at timestamptz not null default now()
);

create index if not exists content_comments_created_at_idx on public.content_comments(created_at desc);
create index if not exists content_comments_status_idx on public.content_comments(status);
create index if not exists content_comments_book_id_idx on public.content_comments(book_id);
create index if not exists content_comments_episode_id_idx on public.content_comments(episode_id);

alter table public.content_comments enable row level security;
