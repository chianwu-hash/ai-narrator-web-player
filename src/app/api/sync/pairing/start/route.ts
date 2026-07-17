import { NextResponse } from "next/server";
import { isRequestAuthenticated } from "@/lib/auth";
import { currentDevice, isSyncConfigured, startPairing, syncNotConfiguredResponse } from "@/lib/sync-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  if (!await isRequestAuthenticated()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isSyncConfigured()) return syncNotConfiguredResponse();
  const device = await currentDevice();
  if (!device) return NextResponse.json({ error: "Sync device is not linked" }, { status: 409 });
  const result = await startPairing(device);
  return NextResponse.json({ enabled: true, linked: true, ...result });
}
