import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { deleteAdminBookWish, listAdminBookWishes, updateAdminBookWishStatus, wishesAvailable } from "@/lib/wishes-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!await isAdminAuthenticated()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!wishesAvailable()) return NextResponse.json({ error: "許願池尚未設定資料庫。" }, { status: 503 });
  try {
    const wishes = await listAdminBookWishes(request.nextUrl.searchParams.get("status") ?? "new");
    return NextResponse.json({ wishes });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "願望讀取失敗。" }, { status: 400 });
  }
}

export async function PATCH(request: NextRequest) {
  if (!await isAdminAuthenticated()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!wishesAvailable()) return NextResponse.json({ error: "許願池尚未設定資料庫。" }, { status: 503 });
  const body = await request.json().catch(() => ({}));
  try {
    const wish = await updateAdminBookWishStatus((body as { id?: unknown }).id, (body as { status?: unknown }).status);
    return NextResponse.json({ ok: true, wish });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "願望更新失敗。" }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest) {
  if (!await isAdminAuthenticated()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!wishesAvailable()) return NextResponse.json({ error: "許願池尚未設定資料庫。" }, { status: 503 });
  try {
    await deleteAdminBookWish(request.nextUrl.searchParams.get("id"));
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "願望刪除失敗。" }, { status: 400 });
  }
}
