alter table public.content_comments
  add column if not exists author_token_hash text,
  add column if not exists updated_at timestamptz,
  add column if not exists deleted_at timestamptz;

create index if not exists content_comments_author_token_hash_idx on public.content_comments(author_token_hash);
create index if not exists content_comments_deleted_at_idx on public.content_comments(deleted_at);
