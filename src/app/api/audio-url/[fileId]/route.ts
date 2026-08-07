import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { isRequestAuthenticated } from "@/lib/auth";
import { checkAudioUrlRateLimit } from "@/lib/audio-access-rate-limit";
import { audioDeliveryConfigured, createSignedAudioUrl } from "@/lib/audio-url";
import { DriveApiError, isAllowedAudioFile, isDriveConfigured } from "@/lib/google-drive";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function clientKey(request: NextRequest): string {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const userAgent = request.headers.get("user-agent") ?? "unknown";
  return createHash("sha256").update(`${ip}\n${userAgent}`).digest("hex").slice(0, 24);
}

export async function GET(request: NextRequest, context: { params: Promise<{ fileId: string }> }) {
  if (!await isRequestAuthenticated()) return NextResponse.json({ error: "未登入" }, { status: 401 });
  if (!audioDeliveryConfigured()) return NextResponse.json({ error: "音訊串流服務尚未設定" }, { status: 503 });
  if (!isDriveConfigured()) return NextResponse.json({ error: "Google Drive 尚未設定" }, { status: 503 });

  const limit = checkAudioUrlRateLimit(clientKey(request));
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "音訊連結請求過於頻繁" },
      { status: 429, headers: { "retry-after": String(limit.retryAfter), "cache-control": "no-store" } },
    );
  }

  try {
    const { fileId } = await context.params;
    if (!await isAllowedAudioFile(fileId)) return NextResponse.json({ error: "找不到音訊" }, { status: 404 });
    return NextResponse.json(createSignedAudioUrl(fileId), { headers: { "cache-control": "no-store" } });
  } catch (error) {
    const status = error instanceof DriveApiError ? error.status : 502;
    return NextResponse.json({ error: error instanceof Error ? error.message : "音訊連結無法建立" }, { status });
  }
}
