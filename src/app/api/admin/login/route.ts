import { NextRequest, NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE, adminSessionMaxAge, createAdminSessionToken, verifyAdminAccessCode } from "@/lib/admin-auth";
import { checkLoginRateLimit, clearLoginAttempts, recordFailedLogin } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const key = `admin:${ip}`;
  const limit = checkLoginRateLimit(key);
  if (!limit.allowed) {
    return NextResponse.json({ error: "嘗試次數過多，請稍後再試。" }, { status: 429, headers: { "retry-after": String(limit.retryAfter) } });
  }
  const body = await request.json().catch(() => ({})) as { code?: string };
  if (!verifyAdminAccessCode(body.code ?? "")) {
    recordFailedLogin(key);
    return NextResponse.json({ error: "管理者碼不正確。" }, { status: 401 });
  }
  clearLoginAttempts(key);
  const response = NextResponse.json({ ok: true });
  response.cookies.set(ADMIN_SESSION_COOKIE, createAdminSessionToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: adminSessionMaxAge,
  });
  return response;
}
