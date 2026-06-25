import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getTopClips } from "@/lib/twitch/stats";

export const runtime = "nodejs";

// Top clips from the trailing week for any channel — public data either way.
export async function GET(req: NextRequest) {
  const channelId = new URL(req.url).searchParams.get("channelId");
  if (!channelId) return NextResponse.json({ clips: [] });

  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ clips: [] });

  const clips = await getTopClips(user, channelId);
  return NextResponse.json({ clips });
}
