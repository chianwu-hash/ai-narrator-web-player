import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { validateContentComment, validateContentCommentUpdate } from "./comment-model";

const COMMENT_AUTHOR_COOKIE = "ai_narrator_comment_author";
const COMMENT_AUTHOR_MAX_AGE = 60 * 60 * 24 * 365;

type CommentRow = {
  id: string;
  target_type: "book" | "episode";
  book_id: string;
  book_title: string;
  episode_id: string | null;
  episode_title: string | null;
  comment_type: "reflection" | "error_report" | "other";
  body: string;
  author_token_hash: string | null;
  status: "new" | "reviewing" | "resolved" | "ignored";
  created_at: string;
  updated_at: string | null;
  deleted_at: string | null;
};

type CommentStatus = CommentRow["status"];

const ADMIN_COMMENT_SELECT = "id,target_type,book_id,book_title,episode_id,episode_title,comment_type,body,author_token_hash,status,created_at,updated_at,deleted_at";

function isSupabaseConfigured(): boolean {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function hashToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

async function getAuthorToken(create: boolean): Promise<string | null> {
  const store = await cookies();
  const existing = store.get(COMMENT_AUTHOR_COOKIE)?.value;
  if (existing) return existing;
  if (!create) return null;
  const token = randomBytes(32).toString("base64url");
  store.set(COMMENT_AUTHOR_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: COMMENT_AUTHOR_MAX_AGE,
  });
  return token;
}

async function supabaseFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!isSupabaseConfigured()) throw new Error("Supabase is not configured");
  const url = `${process.env.SUPABASE_URL!.replace(/\/$/, "")}/rest/v1/${path}`;
  const response = await fetch(url, {
    ...init,
    headers: {
      apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
      authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY!}`,
      "content-type": "application/json",
      prefer: "return=representation",
      ...(init.headers ?? {}),
    },
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Supabase request failed: ${response.status} ${await response.text()}`);
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

function publicComment(row: CommentRow, currentAuthorHash: string | null) {
  return {
    id: row.id,
    targetType: row.target_type,
    bookId: row.book_id,
    bookTitle: row.book_title,
    episodeId: row.episode_id ?? undefined,
    episodeTitle: row.episode_title ?? undefined,
    commentType: row.comment_type,
    body: row.body,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at ?? undefined,
    canEdit: Boolean(currentAuthorHash && row.author_token_hash === currentAuthorHash),
  };
}

function adminComment(row: CommentRow) {
  return {
    id: row.id,
    targetType: row.target_type,
    bookId: row.book_id,
    bookTitle: row.book_title,
    episodeId: row.episode_id ?? undefined,
    episodeTitle: row.episode_title ?? undefined,
    commentType: row.comment_type,
    body: row.body,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at ?? undefined,
    deletedAt: row.deleted_at ?? undefined,
    hasAuthorToken: Boolean(row.author_token_hash),
  };
}

async function getCommentForOwner(id: string, currentAuthorHash: string): Promise<CommentRow> {
  const rows = await supabaseFetch<CommentRow[]>(
    `content_comments?id=eq.${encodeURIComponent(id)}&deleted_at=is.null&select=${ADMIN_COMMENT_SELECT}&limit=1`,
  );
  const row = rows[0];
  if (!row) throw new Error("找不到這則留言。");
  if (!row.author_token_hash || row.author_token_hash !== currentAuthorHash) throw new Error("只能修改或刪除這台瀏覽器送出的留言。");
  return row;
}

export async function listContentComments(bookIdInput: unknown) {
  const bookId = typeof bookIdInput === "string" ? bookIdInput.trim().slice(0, 180) : "";
  if (!bookId) throw new Error("找不到書籍資訊。");
  const token = await getAuthorToken(false);
  const currentAuthorHash = token ? hashToken(token) : null;
  const rows = await supabaseFetch<CommentRow[]>(
    `content_comments?book_id=eq.${encodeURIComponent(bookId)}&deleted_at=is.null&status=neq.ignored&select=${ADMIN_COMMENT_SELECT}&order=created_at.desc&limit=100`,
  );
  return rows.map((row) => publicComment(row, currentAuthorHash));
}

export async function listAdminContentComments(statusInput: unknown = "new") {
  const status = typeof statusInput === "string" ? statusInput : "new";
  const statusFilter = status === "all" ? "" : `&status=eq.${encodeURIComponent(status)}`;
  const rows = await supabaseFetch<CommentRow[]>(
    `content_comments?deleted_at=is.null${statusFilter}&select=${ADMIN_COMMENT_SELECT}&order=created_at.desc&limit=200`,
  );
  return rows.map(adminComment);
}

export async function createContentComment(input: unknown) {
  const parsed = validateContentComment(input);
  if (!parsed.ok) throw new Error(parsed.error);
  const token = await getAuthorToken(true);
  if (!token) throw new Error("無法建立匿名留言身份。");
  const rows = await supabaseFetch<CommentRow[]>("content_comments", {
    method: "POST",
    body: JSON.stringify({
      author_token_hash: hashToken(token),
      target_type: parsed.value.targetType,
      book_id: parsed.value.bookId,
      book_title: parsed.value.bookTitle,
      episode_id: parsed.value.episodeId ?? null,
      episode_title: parsed.value.episodeTitle ?? null,
      comment_type: parsed.value.commentType,
      body: parsed.value.body,
      status: "new",
    }),
  });
  const row = rows[0];
  if (!row) throw new Error("No comment returned from Supabase");
  return publicComment(row, hashToken(token));
}

export async function updateContentComment(idInput: unknown, input: unknown) {
  const id = typeof idInput === "string" ? idInput.trim() : "";
  if (!id) throw new Error("找不到這則留言。");
  const parsed = validateContentCommentUpdate(input);
  if (!parsed.ok) throw new Error(parsed.error);
  const token = await getAuthorToken(false);
  if (!token) throw new Error("只能修改或刪除這台瀏覽器送出的留言。");
  const currentAuthorHash = hashToken(token);
  await getCommentForOwner(id, currentAuthorHash);
  const rows = await supabaseFetch<CommentRow[]>(`content_comments?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify({
      comment_type: parsed.value.commentType,
      body: parsed.value.body,
      updated_at: new Date().toISOString(),
      status: "new",
    }),
  });
  const row = rows[0];
  if (!row) throw new Error("No comment returned from Supabase");
  return publicComment(row, currentAuthorHash);
}

export async function deleteContentComment(idInput: unknown) {
  const id = typeof idInput === "string" ? idInput.trim() : "";
  if (!id) throw new Error("找不到這則留言。");
  const token = await getAuthorToken(false);
  if (!token) throw new Error("只能修改或刪除這台瀏覽器送出的留言。");
  const currentAuthorHash = hashToken(token);
  await getCommentForOwner(id, currentAuthorHash);
  await supabaseFetch<CommentRow[]>(`content_comments?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify({
      deleted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }),
  });
  return { ok: true };
}

export async function updateAdminContentCommentStatus(idInput: unknown, statusInput: unknown) {
  const id = typeof idInput === "string" ? idInput.trim() : "";
  const status = typeof statusInput === "string" ? statusInput.trim() : "";
  const allowed = new Set<CommentStatus>(["new", "reviewing", "resolved", "ignored"]);
  if (!id) throw new Error("找不到這則留言。");
  if (!allowed.has(status as CommentStatus)) throw new Error("留言狀態不正確。");
  const rows = await supabaseFetch<CommentRow[]>(`content_comments?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify({
      status,
      updated_at: new Date().toISOString(),
    }),
  });
  const row = rows[0];
  if (!row) throw new Error("找不到這則留言。");
  return adminComment(row);
}

export async function deleteAdminContentComment(idInput: unknown) {
  const id = typeof idInput === "string" ? idInput.trim() : "";
  if (!id) throw new Error("找不到這則留言。");
  await supabaseFetch<CommentRow[]>(`content_comments?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify({
      deleted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }),
  });
  return { ok: true };
}

export function commentsAvailable(): boolean {
  return isSupabaseConfigured();
}
