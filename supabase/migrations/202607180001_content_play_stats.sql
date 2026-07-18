create table if not exists public.content_play_stats (
  target_key text primary key,
  target_type text not null check (target_type in ('book', 'episode')),
  book_id text not null,
  book_title text not null,
  episode_id text,
  episode_title text,
  play_count bigint not null default 0 check (play_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_played_at timestamptz not null default now(),
  constraint content_play_stats_target_shape_check check (
    (target_type = 'book' and episode_id is null and episode_title is null)
    or
    (target_type = 'episode' and episode_id is not null and episode_title is not null)
  )
);

create index if not exists content_play_stats_rank_idx on public.content_play_stats(target_type, play_count desc, last_played_at desc);
create index if not exists content_play_stats_last_played_at_idx on public.content_play_stats(last_played_at desc);

alter table public.content_play_stats enable row level security;

create or replace function public.record_content_play(
  p_target_type text,
  p_book_id text,
  p_book_title text,
  p_episode_id text default null,
  p_episode_title text default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_target_key text;
begin
  if p_target_type not in ('book', 'episode') then
    raise exception 'Invalid target type';
  end if;

  if nullif(trim(p_book_id), '') is null or nullif(trim(p_book_title), '') is null then
    raise exception 'Book id and title are required';
  end if;

  if p_target_type = 'episode' and (nullif(trim(coalesce(p_episode_id, '')), '') is null or nullif(trim(coalesce(p_episode_title, '')), '') is null) then
    raise exception 'Episode id and title are required';
  end if;

  v_target_key := case
    when p_target_type = 'book' then 'book:' || p_book_id
    else 'episode:' || p_episode_id
  end;

  insert into public.content_play_stats (
    target_key,
    target_type,
    book_id,
    book_title,
    episode_id,
    episode_title,
    play_count,
    created_at,
    updated_at,
    last_played_at
  ) values (
    v_target_key,
    p_target_type,
    p_book_id,
    p_book_title,
    case when p_target_type = 'episode' then p_episode_id else null end,
    case when p_target_type = 'episode' then p_episode_title else null end,
    1,
    now(),
    now(),
    now()
  )
  on conflict (target_key) do update set
    book_title = excluded.book_title,
    episode_title = excluded.episode_title,
    play_count = public.content_play_stats.play_count + 1,
    updated_at = now(),
    last_played_at = now();
end;
$$;
