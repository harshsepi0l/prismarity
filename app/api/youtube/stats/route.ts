import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getYouTubeOwnStats } from "@/lib/youtube/stats";

export const runtime = "nodejs";

// Live status + subscriber count for the connected account's own YouTube
// channel. No channelId param — YouTube has no "watch any channel" flow here.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ stats: null });
  const stats = await getYouTubeOwnStats(user);
  return NextResponse.json({ stats });
}
