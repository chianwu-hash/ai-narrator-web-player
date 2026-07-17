import { NextResponse } from "next/server";
import { isRequestAuthenticated } from "@/lib/auth";
import { claimPairing, isSyncConfigured, syncNotConfiguredResponse } from "@/lib/sync-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!await isRequestAuthenticated()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isSyncConfigured()) return syncNotConfiguredResponse();
  const body = await request.json().catch(() => ({}));
  try {
    const result = await claimPairing(body.code, body.state);
    return NextResponse.json({ enabled: true, linked: true, ...result });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Pairing failed" }, { status: 400 });
  }
}
