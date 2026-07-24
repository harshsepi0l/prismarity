import { NextRequest, NextResponse } from "next/server";
import { isYouTubeChannelLive } from "@/lib/youtube/live";

export const runtime = "nodejs";

// Is the given YouTube channel (by its channel URL, e.g. from a streamer's
// Twitch socials) live right now? Scrape-based, best-effort — see lib/youtube/live.
// The URL is host-guarded inside isYouTubeChannelLive (SSRF).
export async function GET(req: NextRequest) {
  const url = new URL(req.url).searchParams.get("url");
  if (!url) return NextResponse.json({ live: false });
  return NextResponse.json({ live: await isYouTubeChannelLive(url) });
}
