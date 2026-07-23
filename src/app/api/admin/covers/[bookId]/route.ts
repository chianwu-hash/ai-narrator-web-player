import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { DriveApiError, isDriveConfigured, replaceBookCover } from "@/lib/google-drive";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_COVER_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function POST(request: NextRequest, context: { params: Promise<{ bookId: string }> }) {
  if (!await isAdminAuthenticated()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isDriveConfigured()) return NextResponse.json({ error: "Google Drive 書庫尚未設定。" }, { status: 503 });

  try {
    const { bookId } = await context.params;
    const form = await request.formData();
    const file = form.get("cover");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "請上傳封面圖片。" }, { status: 400 });
    }
    if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
      return NextResponse.json({ error: "只支援 JPG、PNG 或 WebP 封面。" }, { status: 400 });
    }
    if (file.size > MAX_COVER_BYTES) {
      return NextResponse.json({ error: "封面圖片請小於 5 MB。" }, { status: 400 });
    }
    const book = await replaceBookCover(bookId, Buffer.from(await file.arrayBuffer()), file.type);
    return NextResponse.json({ ok: true, book });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "封面更新失敗。" },
      { status: error instanceof DriveApiError ? error.status : 400 },
    );
  }
}
