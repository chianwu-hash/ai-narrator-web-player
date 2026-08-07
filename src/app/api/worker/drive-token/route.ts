import { NextRequest, NextResponse } from "next/server";
import { audioTokenBrokerConfigured, authorizeAudioTokenBroker } from "@/lib/audio-token-broker";
import { driveReadOnlyAccessToken, DriveApiError, isDriveConfigured } from "@/lib/google-drive";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const noStoreHeaders = { "cache-control": "private, no-store" };

export async function POST(request: NextRequest) {
  if (!audioTokenBrokerConfigured() || !authorizeAudioTokenBroker(request.headers.get("authorization"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: noStoreHeaders });
  }
  if (!isDriveConfigured()) {
    return NextResponse.json({ error: "Google Drive is not configured" }, { status: 503, headers: noStoreHeaders });
  }

  try {
    return NextResponse.json(await driveReadOnlyAccessToken(), { headers: noStoreHeaders });
  } catch (error) {
    const status = error instanceof DriveApiError ? error.status : 502;
    return NextResponse.json({ error: "Drive token unavailable" }, { status, headers: noStoreHeaders });
  }
}
