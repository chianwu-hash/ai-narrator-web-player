export type BookWishStatus = "new" | "reviewing" | "accepted" | "rejected" | "done";

export type BookWishInput = {
  title: string;
  author?: string;
  reason: string;
};

export type BookWishValidation =
  | { ok: true; value: BookWishInput }
  | { ok: false; error: string };

function cleanText(value: unknown, maxLength: number): string {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, maxLength) : "";
}

export function validateBookWish(input: unknown): BookWishValidation {
  if (!input || typeof input !== "object") return { ok: false, error: "許願資料格式不正確。" };
  const data = input as Record<string, unknown>;
  const title = cleanText(data.title, 160);
  const author = cleanText(data.author, 100);
  const reason = cleanText(data.reason, 1000);
  if (title.length < 2) return { ok: false, error: "請填寫想聽的書名。" };
  if (reason.length < 4) return { ok: false, error: "推薦理由至少需要 4 個字。" };
  return { ok: true, value: { title, author: author || undefined, reason } };
}
