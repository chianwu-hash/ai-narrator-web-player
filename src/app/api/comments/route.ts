import { NextRequest, NextResponse } from "next/server";
import { isRequestAuthenticated } from "@/lib/auth";
import { commentsAvailable, createContentComment, deleteContentComment, listContentComments, updateContentComment } from "@/lib/comments-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CommentAttempt = { count: number; resetAt: number };
const attempts = new Map<string, CommentAttempt>();
const WINDOW_MS = 10 * 60 * 1000;
const MAX_COMMENTS = 5;

function checkCommentRateLimit(key: string, now = Date.now()): { allowed: boolean; retryAfter: number } {
  const entry = attempts.get(key);
  if (!entry || now >= entry.resetAt) {
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return { allowed: true, retryAfter: 0 };
  }
  if (entry.count >= MAX_COMMENTS) return { allowed: false, retryAfter: Math.ceil((entry.resetAt - now) / 1000) };
  entry.count += 1;
  attempts.set(key, entry);
  return { allowed: true, retryAfter: 0 };
}

export async function POST(request: NextRequest) {
  if (!await isRequestAuthenticated()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!commentsAvailable()) return NextResponse.json({ error: "留言功能尚未設定資料庫。" }, { status: 503 });

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const limit = checkCommentRateLimit(ip);
  if (!limit.allowed) {
    return NextResponse.json({ error: "留言送出太頻繁，請稍後再試。" }, { status: 429, headers: { "retry-after": String(limit.retryAfter) } });
  }

  const body = await request.json().catch(() => ({}));
  try {
    const comment = await createContentComment(body);
    return NextResponse.json({ ok: true, comment });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "留言送出失敗。" }, { status: 400 });
  }
}

export async function GET(request: NextRequest) {
  if (!await isRequestAuthenticated()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!commentsAvailable()) return NextResponse.json({ error: "留言功能尚未設定資料庫。" }, { status: 503 });
  try {
    const comments = await listContentComments(request.nextUrl.searchParams.get("bookId"));
    return NextResponse.json({ comments });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "留言讀取失敗。" }, { status: 400 });
  }
}

export async function PATCH(request: NextRequest) {
  if (!await isRequestAuthenticated()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!commentsAvailable()) return NextResponse.json({ error: "留言功能尚未設定資料庫。" }, { status: 503 });
  const body = await request.json().catch(() => ({}));
  try {
    const comment = await updateContentComment(body.id, body);
    return NextResponse.json({ ok: true, comment });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "留言更新失敗。" }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest) {
  if (!await isRequestAuthenticated()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!commentsAvailable()) return NextResponse.json({ error: "留言功能尚未設定資料庫。" }, { status: 503 });
  try {
    await deleteContentComment(request.nextUrl.searchParams.get("id"));
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "留言刪除失敗。" }, { status: 400 });
  }
}
