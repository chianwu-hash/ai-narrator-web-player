import { NextResponse } from "next/server";
import { isRequestAuthenticated } from "@/lib/auth";
import { buildDriveLibrary, DriveApiError, isDriveConfigured } from "@/lib/google-drive";
import { mockLibrary } from "@/lib/mock-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!await isRequestAuthenticated()) return NextResponse.json({ error: "未登入" }, { status: 401 });
  if (!isDriveConfigured() || process.env.DRIVE_MODE === "mock") return NextResponse.json(mockLibrary());
  try {
    const books = await buildDriveLibrary();
    return NextResponse.json({ books, source: "drive", generatedAt: new Date().toISOString() }, { headers: { "cache-control": "private, max-age=60" } });
  } catch (error) {
    const message = error instanceof DriveApiError ? error.message : "書庫暫時無法讀取。";
    return NextResponse.json(mockLibrary(message), { status: 200 });
  }
}
