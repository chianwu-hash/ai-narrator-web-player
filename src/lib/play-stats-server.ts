export type PlayTargetType = "book" | "episode";

export type ContentPlayStat = {
  targetKey: string;
  targetType: PlayTargetType;
  bookId: string;
  bookTitle: string;
  episodeId?: string;
  episodeTitle?: string;
  playCount: number;
  lastPlayedAt: string;
};

type PlayStatRow = {
  target_key: string;
  target_type: PlayTargetType;
  book_id: string;
  book_title: string;
  episode_id?: string | null;
  episode_title?: string | null;
  play_count: number | string;
  last_played_at: string;
};

type RecordContentPlayInput = {
  targetType?: unknown;
  bookId?: unknown;
  bookTitle?: unknown;
  episodeId?: unknown;
  episodeTitle?: unknown;
};

const STATS_LIMIT = 6;

export function playStatsAvailable(): boolean {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

async function supabaseFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const url = `${process.env.SUPABASE_URL!.replace(/\/$/, "")}/rest/v1/${path}`;
  const response = await fetch(url, {
    ...init,
    headers: {
      apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
      authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY!}`,
      "content-type": "application/json",
      ...(init.headers ?? {}),
    },
    cache: "no-store",
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Supabase request failed: ${response.status} ${text}`);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

function textValue(value: unknown, field: string, maxLength = 240): string {
  if (typeof value !== "string") throw new Error(`${field} is required`);
  const trimmed = value.trim();
  if (!trimmed) throw new Error(`${field} is required`);
  return trimmed.slice(0, maxLength);
}

function normalizeInput(input: RecordContentPlayInput) {
  const targetType = input.targetType === "book" || input.targetType === "episode" ? input.targetType : undefined;
  if (!targetType) throw new Error("targetType must be book or episode");
  const bookId = textValue(input.bookId, "bookId", 180);
  const bookTitle = textValue(input.bookTitle, "bookTitle", 240);
  const episodeId = targetType === "episode" ? textValue(input.episodeId, "episodeId", 180) : undefined;
  const episodeTitle = targetType === "episode" ? textValue(input.episodeTitle, "episodeTitle", 240) : undefined;
  return { targetType, bookId, bookTitle, episodeId, episodeTitle };
}

async function recordOne(input: ReturnType<typeof normalizeInput>) {
  await supabaseFetch("rpc/record_content_play", {
    method: "POST",
    body: JSON.stringify({
      p_target_type: input.targetType,
      p_book_id: input.bookId,
      p_book_title: input.bookTitle,
      p_episode_id: input.episodeId ?? null,
      p_episode_title: input.episodeTitle ?? null,
    }),
  });
}

export async function recordContentPlay(input: RecordContentPlayInput) {
  const normalized = normalizeInput(input);
  if (normalized.targetType === "episode") {
    await recordOne(normalized);
    await recordOne({ targetType: "book", bookId: normalized.bookId, bookTitle: normalized.bookTitle, episodeId: undefined, episodeTitle: undefined });
    return;
  }
  await recordOne(normalized);
}

function mapRow(row: PlayStatRow): ContentPlayStat {
  return {
    targetKey: row.target_key,
    targetType: row.target_type,
    bookId: row.book_id,
    bookTitle: row.book_title,
    episodeId: row.episode_id ?? undefined,
    episodeTitle: row.episode_title ?? undefined,
    playCount: Number(row.play_count) || 0,
    lastPlayedAt: row.last_played_at,
  };
}

async function listByType(targetType: PlayTargetType): Promise<ContentPlayStat[]> {
  const query = new URLSearchParams({
    target_type: `eq.${targetType}`,
    select: "target_key,target_type,book_id,book_title,episode_id,episode_title,play_count,last_played_at",
    order: "play_count.desc,last_played_at.desc",
    limit: String(STATS_LIMIT),
  });
  const rows = await supabaseFetch<PlayStatRow[]>(`content_play_stats?${query.toString()}`);
  return rows.map(mapRow);
}

export async function listContentPlayStats() {
  const [popularBooks, popularEpisodes] = await Promise.all([
    listByType("book"),
    listByType("episode"),
  ]);
  return { popularBooks, popularEpisodes };
}
