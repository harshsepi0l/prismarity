import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getAllYouTubeStats } from "@/lib/youtube/stats";

export const runtime = "nodejs";

// Live status + subscriber count for EVERY YouTube channel the user has
// connected. No channelId param — each channel is its own OAuth grant, so this
// returns all of the user's own channels.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ channels: [] });
  const channels = await getAllYouTubeStats(user);
  return NextResponse.json({ channels });
}
