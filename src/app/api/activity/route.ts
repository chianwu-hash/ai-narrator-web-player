import { NextResponse } from "next/server";
import { isRequestAuthenticated } from "@/lib/auth";
import { deviceActivityAvailable, recordDeviceActivity } from "@/lib/device-activity-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  if (!await isRequestAuthenticated()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!deviceActivityAvailable()) return NextResponse.json({ enabled: false });
  try {
    const device = await recordDeviceActivity();
    return NextResponse.json({ ok: true, device });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "設備活動紀錄失敗。" }, { status: 400 });
  }
}
