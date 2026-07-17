import { NextResponse } from "next/server";
import { isRequestAuthenticated } from "@/lib/auth";
import { currentDevice, isSyncConfigured, mergeDeviceState, readDeviceState, syncNotConfiguredResponse } from "@/lib/sync-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!await isRequestAuthenticated()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isSyncConfigured()) return syncNotConfiguredResponse();
  const device = await currentDevice();
  if (!device) return NextResponse.json({ enabled: true, linked: false });
  const state = await readDeviceState(device);
  return NextResponse.json({ enabled: true, linked: true, state, profileId: device.profile_id, deviceId: device.id });
}

export async function PUT(request: Request) {
  if (!await isRequestAuthenticated()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isSyncConfigured()) return syncNotConfiguredResponse();
  const device = await currentDevice();
  if (!device) return NextResponse.json({ error: "Sync device is not linked" }, { status: 409 });
  const body = await request.json().catch(() => ({}));
  const result = await mergeDeviceState(device, body.state, "incoming");
  return NextResponse.json({ enabled: true, linked: true, ...result });
}
