export type Episode = {
  id: string;
  bookId: string;
  number: number;
  title: string;
  fileName: string;
  mimeType: string;
  size?: number;
  duration?: number;
};

export type Book = {
  id: string;
  title: string;
  subtitle?: string;
  coverFileId?: string;
  modifiedTime?: string;
  episodes: Episode[];
};

export type LibraryResponse = {
  books: Book[];
  source: "drive" | "mock";
  notice?: string;
  generatedAt: string;
};

export type EpisodeProgress = {
  episodeId: string;
  bookId: string;
  position: number;
  duration: number;
  completed: boolean;
  lastPlayedAt: string;
};

export type LocalPlayerState = {
  progress: Record<string, EpisodeProgress>;
  favoriteBookIds: string[];
  favoriteEpisodeIds: string[];
  playbackRate: number;
  themeId: ThemeId;
  lastEpisodeId?: string;
};

export type ThemeId = "study-green" | "paper-warm" | "night-ink";
