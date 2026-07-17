import { EMPTY_PLAYER_STATE } from "./progress-model.ts";
import type { EpisodeProgress, LocalPlayerState, ThemeId } from "./types.ts";

type FavoriteMergeMode = "incoming" | "union";

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((item): item is string => typeof item === "string" && item.length > 0))];
}

function numberValue(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function themeValue(value: unknown): ThemeId {
  return value === "paper-warm" || value === "night-ink" || value === "study-green" ? value : "study-green";
}

function progressValue(value: unknown): Record<string, EpisodeProgress> {
  if (!value || typeof value !== "object") return {};
  const output: Record<string, EpisodeProgress> = {};
  for (const [episodeId, item] of Object.entries(value as Record<string, unknown>)) {
    if (!item || typeof item !== "object") continue;
    const progress = item as Record<string, unknown>;
    const bookId = progress.bookId;
    const lastPlayedAt = progress.lastPlayedAt;
    if (typeof bookId !== "string" || typeof lastPlayedAt !== "string") continue;
    output[episodeId] = {
      episodeId,
      bookId,
      position: Math.max(0, numberValue(progress.position, 0)),
      duration: Math.max(0, numberValue(progress.duration, 0)),
      completed: progress.completed === true,
      lastPlayedAt,
    };
  }
  return output;
}

export function normalizePlayerState(input: unknown): LocalPlayerState {
  if (!input || typeof input !== "object") return { ...EMPTY_PLAYER_STATE };
  const value = input as Record<string, unknown>;
  return {
    progress: progressValue(value.progress),
    favoriteBookIds: stringArray(value.favoriteBookIds),
    favoriteEpisodeIds: stringArray(value.favoriteEpisodeIds),
    playbackRate: Math.min(3, Math.max(0.5, numberValue(value.playbackRate, 1))),
    themeId: themeValue(value.themeId),
    lastEpisodeId: typeof value.lastEpisodeId === "string" ? value.lastEpisodeId : undefined,
  };
}

function latestProgress(a?: EpisodeProgress, b?: EpisodeProgress): EpisodeProgress | undefined {
  if (!a) return b;
  if (!b) return a;
  const aTime = Date.parse(a.lastPlayedAt) || 0;
  const bTime = Date.parse(b.lastPlayedAt) || 0;
  return bTime >= aTime ? b : a;
}

function mergeIds(a: string[], b: string[], mode: FavoriteMergeMode): string[] {
  return mode === "union" ? [...new Set([...a, ...b])] : b;
}

function newestLastEpisode(state: LocalPlayerState): string | undefined {
  let latestId = state.lastEpisodeId;
  let latestTime = latestId ? Date.parse(state.progress[latestId]?.lastPlayedAt ?? "") || 0 : 0;
  for (const progress of Object.values(state.progress)) {
    const time = Date.parse(progress.lastPlayedAt) || 0;
    if (time > latestTime) {
      latestTime = time;
      latestId = progress.episodeId;
    }
  }
  return latestId;
}

export function mergePlayerStates(
  baseInput: unknown,
  incomingInput: unknown,
  favoriteMode: FavoriteMergeMode = "incoming",
): LocalPlayerState {
  const base = normalizePlayerState(baseInput);
  const incoming = normalizePlayerState(incomingInput);
  const progress: Record<string, EpisodeProgress> = { ...base.progress };
  for (const [episodeId, item] of Object.entries(incoming.progress)) {
    const latest = latestProgress(progress[episodeId], item);
    if (latest) progress[episodeId] = latest;
  }
  const merged: LocalPlayerState = {
    progress,
    favoriteBookIds: mergeIds(base.favoriteBookIds, incoming.favoriteBookIds, favoriteMode),
    favoriteEpisodeIds: mergeIds(base.favoriteEpisodeIds, incoming.favoriteEpisodeIds, favoriteMode),
    playbackRate: incoming.playbackRate || base.playbackRate || 1,
    themeId: incoming.themeId || base.themeId || "study-green",
    lastEpisodeId: incoming.lastEpisodeId || base.lastEpisodeId,
  };
  return { ...merged, lastEpisodeId: newestLastEpisode(merged) };
}
