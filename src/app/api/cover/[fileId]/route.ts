import { NextResponse } from "next/server";
import { isRequestAuthenticated } from "@/lib/auth";
import { DriveApiError, isDriveConfigured, streamDriveFile } from "@/lib/google-drive";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ fileId: string }> }) {
  if (!await isRequestAuthenticated()) return NextResponse.json({ error: "未登入" }, { status: 401 });
  if (!isDriveConfigured()) return NextResponse.json({ error: "沒有封面" }, { status: 404 });
  try {
    const { fileId } = await context.params;
    const upstream = await streamDriveFile(fileId);
    return new Response(upstream.body, {
      status: upstream.status,
      headers: { "content-type": upstream.headers.get("content-type") ?? "image/jpeg", "cache-control": "private, max-age=86400" },
    });
  } catch (error) {
    return NextResponse.json({ error: "封面無法讀取" }, { status: error instanceof DriveApiError ? error.status : 502 });
  }
}
