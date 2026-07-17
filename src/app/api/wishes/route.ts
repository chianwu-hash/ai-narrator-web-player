import { NextRequest, NextResponse } from "next/server";
import { isRequestAuthenticated } from "@/lib/auth";
import { createBookWish, wishesAvailable } from "@/lib/wishes-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type WishAttempt = { count: number; resetAt: number };
const attempts = new Map<string, WishAttempt>();
const WINDOW_MS = 10 * 60 * 1000;
const MAX_WISHES = 4;

function checkWishRateLimit(key: string, now = Date.now()): { allowed: boolean; retryAfter: number } {
  const entry = attempts.get(key);
  if (!entry || now >= entry.resetAt) {
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return { allowed: true, retryAfter: 0 };
  }
  if (entry.count >= MAX_WISHES) return { allowed: false, retryAfter: Math.ceil((entry.resetAt - now) / 1000) };
  entry.count += 1;
  attempts.set(key, entry);
  return { allowed: true, retryAfter: 0 };
}

export async function POST(request: NextRequest) {
  if (!await isRequestAuthenticated()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!wishesAvailable()) return NextResponse.json({ error: "許願池尚未設定資料庫。" }, { status: 503 });

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const limit = checkWishRateLimit(ip);
  if (!limit.allowed) {
    return NextResponse.json({ error: "許願送出太頻繁，請稍後再試。" }, { status: 429, headers: { "retry-after": String(limit.retryAfter) } });
  }

  const body = await request.json().catch(() => ({}));
  try {
    const wish = await createBookWish(body);
    return NextResponse.json({ ok: true, wish });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "許願送出失敗。" }, { status: 400 });
  }
}
