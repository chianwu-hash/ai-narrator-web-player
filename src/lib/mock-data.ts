import type { Book, LibraryResponse } from "./types";

const titles = [
  ["深度工作力", "在分心的世界專注前行"],
  ["遠方的蜂蜜與雷聲", "四位鋼琴家與一場改變人生的比賽"],
  ["人類大歷史", "從認知革命走向科技時代"],
];

export const MOCK_BOOKS: Book[] = titles.map(([title, subtitle], bookIndex) => {
  const bookId = `mock-book-${bookIndex + 1}`;
  return {
    id: bookId,
    title,
    subtitle,
    episodes: Array.from({ length: bookIndex === 1 ? 8 : 6 }, (_, index) => ({
      id: `mock-episode-${bookIndex + 1}-${index + 1}`,
      bookId,
      number: index + 1,
      title: ["重新理解注意力", "專注不是意志力", "建立你的深度儀式", "移除看不見的干擾", "讓休息成為能力", "把洞見帶回生活", "新的起點", "尾聲"][index],
      fileName: `EP${String(index + 1).padStart(2, "0")}.mp3`,
      mimeType: "audio/mpeg",
      duration: 1200 + index * 137,
    })),
  };
});

export function mockLibrary(notice = "尚未連接 Google Drive，目前顯示示範書庫。設定憑證後會自動切換為真實內容。"): LibraryResponse {
  return { books: MOCK_BOOKS, source: "mock", notice, generatedAt: new Date().toISOString() };
}
