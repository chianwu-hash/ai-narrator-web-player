import type { EpisodeProgress, LocalPlayerState } from "./types.ts";

export const EMPTY_PLAYER_STATE: LocalPlayerState = {
  progress: {}, favoriteBookIds: [], favoriteEpisodeIds: [], playbackRate: 1,
};

export function isEpisodeCompleted(position: number, duration: number): boolean {
  return duration > 0 && (duration - position <= 15 || position / duration >= 0.98);
}

export function upsertProgress(
  state: LocalPlayerState,
  input: Omit<EpisodeProgress, "completed" | "lastPlayedAt"> & Partial<Pick<EpisodeProgress, "completed" | "lastPlayedAt">>,
): LocalPlayerState {
  const completed = input.completed ?? isEpisodeCompleted(input.position, input.duration);
  const progress: EpisodeProgress = {
    ...input,
    completed,
    lastPlayedAt: input.lastPlayedAt ?? new Date().toISOString(),
  };
  return { ...state, progress: { ...state.progress, [input.episodeId]: progress }, lastEpisodeId: input.episodeId };
}

function toggleId(values: string[], id: string): string[] {
  return values.includes(id) ? values.filter((value) => value !== id) : [...values, id];
}

export const toggleBookFavorite = (state: LocalPlayerState, id: string): LocalPlayerState =>
  ({ ...state, favoriteBookIds: toggleId(state.favoriteBookIds, id) });

export const toggleEpisodeFavorite = (state: LocalPlayerState, id: string): LocalPlayerState =>
  ({ ...state, favoriteEpisodeIds: toggleId(state.favoriteEpisodeIds, id) });

export function resumePosition(progress?: EpisodeProgress): number {
  if (!progress || progress.completed) return 0;
  return Math.max(0, progress.position - 2);
}
