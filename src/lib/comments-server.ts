import { validateContentComment } from "./comment-model";

type InsertedComment = {
  id: string;
  created_at: string;
};

function isSupabaseConfigured(): boolean {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

async function insertComment(body: unknown): Promise<InsertedComment> {
  if (!isSupabaseConfigured()) throw new Error("Supabase is not configured");
  const url = `${process.env.SUPABASE_URL!.replace(/\/$/, "")}/rest/v1/content_comments`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
      authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY!}`,
      "content-type": "application/json",
      prefer: "return=representation",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Supabase request failed: ${response.status} ${await response.text()}`);
  const rows = await response.json() as InsertedComment[];
  if (!rows[0]) throw new Error("No comment returned from Supabase");
  return rows[0];
}

export async function createContentComment(input: unknown): Promise<InsertedComment> {
  const parsed = validateContentComment(input);
  if (!parsed.ok) throw new Error(parsed.error);
  return insertComment({
    target_type: parsed.value.targetType,
    book_id: parsed.value.bookId,
    book_title: parsed.value.bookTitle,
    episode_id: parsed.value.episodeId ?? null,
    episode_title: parsed.value.episodeTitle ?? null,
    comment_type: parsed.value.commentType,
    body: parsed.value.body,
    status: "new",
  });
}

export function commentsAvailable(): boolean {
  return isSupabaseConfigured();
}
