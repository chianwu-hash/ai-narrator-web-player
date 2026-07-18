import { NextRequest, NextResponse } from "next/server";
import { isRequestAuthenticated } from "@/lib/auth";
import { listContentPlayStats, playStatsAvailable, recordContentPlay } from "@/lib/play-stats-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!await isRequestAuthenticated()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!playStatsAvailable()) return NextResponse.json({ enabled: false, popularBooks: [], popularEpisodes: [] });
  try {
    const stats = await listContentPlayStats();
    return NextResponse.json({ enabled: true, ...stats });
  } catch (error) {
    return NextResponse.json({ enabled: false, popularBooks: [], popularEpisodes: [], error: error instanceof Error ? error.message : "Stats unavailable" }, { status: 200 });
  }
}

export async function POST(request: NextRequest) {
  if (!await isRequestAuthenticated()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!playStatsAvailable()) return NextResponse.json({ enabled: false, ok: false });
  const body = await request.json().catch(() => ({}));
  try {
    await recordContentPlay(body);
    return NextResponse.json({ enabled: true, ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Stats write failed" }, { status: 400 });
  }
}
