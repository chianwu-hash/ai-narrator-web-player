import { NextRequest, NextResponse } from "next/server";
import { isRequestAuthenticated } from "@/lib/auth";
import { DriveApiError, isDriveConfigured, normalizeAudioRange, streamDriveFile } from "@/lib/google-drive";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(request: NextRequest, context: { params: Promise<{ fileId: string }> }) {
  if (!await isRequestAuthenticated()) return NextResponse.json({ error: "未登入" }, { status: 401 });
  if (!isDriveConfigured()) return NextResponse.json({ error: "示範模式沒有音訊。設定 Google Drive 後即可播放。" }, { status: 503 });
  try {
    const { fileId } = await context.params;
    const upstream = await streamDriveFile(fileId, normalizeAudioRange(request.headers.get("range")));
    const headers = new Headers();
    for (const key of ["content-type", "content-length", "content-range", "accept-ranges", "etag", "last-modified"]) {
      const value = upstream.headers.get(key);
      if (value) headers.set(key, value);
    }
    headers.set("accept-ranges", "bytes");
    headers.set("cache-control", "private, max-age=3600");
    return new Response(upstream.body, { status: upstream.status, headers });
  } catch (error) {
    const status = error instanceof DriveApiError ? error.status : 502;
    return NextResponse.json({ error: error instanceof Error ? error.message : "音訊無法讀取" }, { status });
  }
}
