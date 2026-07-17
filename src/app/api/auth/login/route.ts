import { NextRequest, NextResponse } from "next/server";
import { createSessionToken, SESSION_COOKIE, sessionMaxAge, verifyAccessCode } from "@/lib/auth";
import { checkLoginRateLimit, clearLoginAttempts, recordFailedLogin } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const limit = checkLoginRateLimit(ip);
  if (!limit.allowed) {
    return NextResponse.json({ error: "嘗試次數過多，請稍後再試。" }, { status: 429, headers: { "retry-after": String(limit.retryAfter) } });
  }
  const body = await request.json().catch(() => ({})) as { code?: string };
  if (!verifyAccessCode(body.code ?? "")) {
    recordFailedLogin(ip);
    return NextResponse.json({ error: "邀請碼不正確。" }, { status: 401 });
  }
  clearLoginAttempts(ip);
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, createSessionToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: sessionMaxAge,
  });
  return response;
}
