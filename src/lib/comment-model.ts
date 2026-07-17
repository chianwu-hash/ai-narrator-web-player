export const COMMENT_TYPES = ["reflection", "error_report", "other"] as const;
export const COMMENT_TARGET_TYPES = ["book", "episode"] as const;

export type CommentType = typeof COMMENT_TYPES[number];
export type CommentTargetType = typeof COMMENT_TARGET_TYPES[number];

export type ContentCommentInput = {
  targetType: CommentTargetType;
  bookId: string;
  bookTitle: string;
  episodeId?: string;
  episodeTitle?: string;
  commentType: CommentType;
  body: string;
};

export type ContentCommentValidation = {
  ok: true;
  value: ContentCommentInput;
} | {
  ok: false;
  error: string;
};

function cleanText(value: unknown, maxLength: number): string {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, maxLength) : "";
}

function cleanBody(value: unknown): string {
  return typeof value === "string" ? value.trim().slice(0, 1000) : "";
}

function isCommentType(value: unknown): value is CommentType {
  return COMMENT_TYPES.includes(value as CommentType);
}

function isTargetType(value: unknown): value is CommentTargetType {
  return COMMENT_TARGET_TYPES.includes(value as CommentTargetType);
}

export function validateContentComment(input: unknown): ContentCommentValidation {
  if (!input || typeof input !== "object") return { ok: false, error: "留言資料格式不正確。" };
  const data = input as Record<string, unknown>;
  const targetType = data.targetType;
  const commentType = data.commentType;
  if (!isTargetType(targetType)) return { ok: false, error: "留言目標不正確。" };
  if (!isCommentType(commentType)) return { ok: false, error: "留言類型不正確。" };

  const bookId = cleanText(data.bookId, 180);
  const bookTitle = cleanText(data.bookTitle, 240);
  const episodeId = cleanText(data.episodeId, 180);
  const episodeTitle = cleanText(data.episodeTitle, 240);
  const body = cleanBody(data.body);

  if (!bookId || !bookTitle) return { ok: false, error: "找不到書籍資訊。" };
  if (targetType === "episode" && (!episodeId || !episodeTitle)) return { ok: false, error: "找不到單集資訊。" };
  if (body.length < 4) return { ok: false, error: "留言至少需要 4 個字。" };

  return {
    ok: true,
    value: {
      targetType,
      bookId,
      bookTitle,
      episodeId: targetType === "episode" ? episodeId : undefined,
      episodeTitle: targetType === "episode" ? episodeTitle : undefined,
      commentType,
      body,
    },
  };
}
