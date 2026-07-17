import { NextResponse } from "next/server";
import { isRequestAuthenticated } from "@/lib/auth";
import { createProfileWithDevice, currentDevice, isSyncConfigured, mergeDeviceState, syncNotConfiguredResponse } from "@/lib/sync-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!await isRequestAuthenticated()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isSyncConfigured()) return syncNotConfiguredResponse();
  const body = await request.json().catch(() => ({}));
  const existingDevice = await currentDevice();
  if (existingDevice) {
    const result = await mergeDeviceState(existingDevice, body.state, "union");
    return NextResponse.json({ enabled: true, linked: true, profileId: existingDevice.profile_id, deviceId: existingDevice.id, ...result });
  }
  const result = await createProfileWithDevice(body.state);
  return NextResponse.json({ enabled: true, linked: true, ...result });
}
