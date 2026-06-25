import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getChannelBadges } from "@/lib/twitch/badges";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const channelId = new URL(req.url).searchParams.get("channelId");
  if (!channelId) return NextResponse.json({ badges: {} });

  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ badges: {} });

  const badges = await getChannelBadges(user, channelId);
  return NextResponse.json({ badges });
}
