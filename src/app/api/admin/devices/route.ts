import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { deviceActivityAvailable, listAdminDeviceActivity } from "@/lib/device-activity-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!await isAdminAuthenticated()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!deviceActivityAvailable()) return NextResponse.json({ error: "設備監控尚未設定資料庫。" }, { status: 503 });
  try {
    const activity = await listAdminDeviceActivity();
    return NextResponse.json(activity);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "設備活動讀取失敗。" }, { status: 400 });
  }
}
