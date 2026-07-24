import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getYouTubeLiveInfo } from "@/lib/youtube/live";
import { getLiveChatIdForVideo } from "@/lib/youtube/chat";

export const runtime = "nodejs";

// Resolve a TUNED streamer's YouTube channel URL (from their Twitch socials) for
// their live simulcast chat. `videoId` (from the /live scrape, host-guarded for
// SSRF) drives READING via InnerTube (no OAuth needed). `liveChatId` is the SEND
// target (videos.list + the caller's token) — best-effort: null when YouTube
// isn't connected, so reading still works without it and send is simply hidden.
//
//   { live: false }                       → not live on YouTube
//   { live: true, videoId, liveChatId|null }
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ live: false }, { status: 401 });

  const url = new URL(req.url).searchParams.get("url");
  if (!url) return NextResponse.json({ live: false });

  const info = await getYouTubeLiveInfo(url);
  if (!info.live || !info.videoId) return NextResponse.json({ live: false });

  const liveChatId = await getLiveChatIdForVideo(user, info.videoId);

  return NextResponse.json({ live: true, videoId: info.videoId, liveChatId });
}
