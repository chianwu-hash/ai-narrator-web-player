import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { commentsAvailable, deleteAdminContentComment, listAdminContentComments, updateAdminContentCommentStatus } from "@/lib/comments-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!await isAdminAuthenticated()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!commentsAvailable()) return NextResponse.json({ error: "留言功能尚未設定資料庫。" }, { status: 503 });
  try {
    const comments = await listAdminContentComments(request.nextUrl.searchParams.get("status") ?? "new");
    return NextResponse.json({ comments });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "留言讀取失敗。" }, { status: 400 });
  }
}

export async function PATCH(request: NextRequest) {
  if (!await isAdminAuthenticated()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!commentsAvailable()) return NextResponse.json({ error: "留言功能尚未設定資料庫。" }, { status: 503 });
  const body = await request.json().catch(() => ({}));
  try {
    const comment = await updateAdminContentCommentStatus((body as { id?: unknown }).id, (body as { status?: unknown }).status);
    return NextResponse.json({ ok: true, comment });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "留言更新失敗。" }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest) {
  if (!await isAdminAuthenticated()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!commentsAvailable()) return NextResponse.json({ error: "留言功能尚未設定資料庫。" }, { status: 503 });
  try {
    await deleteAdminContentComment(request.nextUrl.searchParams.get("id"));
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "留言刪除失敗。" }, { status: 400 });
  }
}
