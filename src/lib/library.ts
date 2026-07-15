import type { Book, Episode } from "./types.ts";

export type DriveItem = {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime?: string;
  size?: string;
};

const AUDIO_MIME_TYPES = new Set([
  "audio/mpeg", "audio/mp4", "audio/x-m4a", "audio/aac",
  "audio/wav", "audio/x-wav", "audio/ogg", "audio/webm",
]);

const COVER_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const IGNORED_AUDIO = /(?:^|[\s._-])(intro|outro|theme|music|test|temp|tmp|draft|sample)(?:[\s._-]|$)|開場音樂|結尾音樂|片頭音樂|片尾音樂|測試|暫存|工作檔/i;

export function isAllowedAudio(file: DriveItem): boolean {
  return AUDIO_MIME_TYPES.has(file.mimeType) && !IGNORED_AUDIO.test(file.name);
}

export function extractEpisodeNumber(name: string): number | null {
  const stem = name.replace(/\.[^.]+$/, "");
  const explicit = stem.match(/(?:^|[\s._-])(?:ep(?:isode)?|第)\s*0*(\d{1,4})\s*(?:集)?(?:[\s._-]|$)/i);
  if (explicit) return Number(explicit[1]);
  const leading = stem.match(/^\s*0*(\d{1,4})(?:\s*集)?(?:[\s._-]|$)/);
  return leading ? Number(leading[1]) : null;
}

export function episodeTitle(name: string, number: number): string {
  const stem = name.replace(/\.[^.]+$/, "");
  const cleaned = stem
    .replace(new RegExp(`^\\s*(?:ep(?:isode)?\\s*)?0*${number}(?:\\s*集)?[\\s._-]*`, "i"), "")
    .replace(new RegExp(`^\\s*第\\s*0*${number}\\s*集[\\s._-]*`), "")
    .replace(/[_]+/g, " ")
    .trim();
  return cleaned || `第 ${number} 集`;
}

export function naturalEpisodeSort(a: Episode, b: Episode): number {
  return a.number - b.number || a.fileName.localeCompare(b.fileName, "zh-Hant", { numeric: true });
}

export function indexBookFolder(folder: DriveItem, children: DriveItem[]): Book | null {
  const episodes = children
    .filter(isAllowedAudio)
    .map((file, index) => {
      const number = extractEpisodeNumber(file.name) ?? 10_000 + index;
      return {
        id: file.id,
        bookId: folder.id,
        number,
        title: episodeTitle(file.name, number),
        fileName: file.name,
        mimeType: file.mimeType,
        size: file.size ? Number(file.size) : undefined,
      } satisfies Episode;
    })
    .sort(naturalEpisodeSort);

  if (episodes.length === 0) return null;
  const cover = children.find((file) => COVER_MIME_TYPES.has(file.mimeType) && /cover|封面/i.test(file.name))
    ?? children.find((file) => COVER_MIME_TYPES.has(file.mimeType));

  return {
    id: folder.id,
    title: folder.name.trim(),
    coverFileId: cover?.id,
    modifiedTime: folder.modifiedTime,
    episodes,
  };
}

export function coverKind(book: Book): "image" | "fallback" {
  return book.coverFileId ? "image" : "fallback";
}
