import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getChannelStats } from "@/lib/twitch/stats";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const channelId = new URL(req.url).searchParams.get("channelId");
  if (!channelId) return NextResponse.json({ stats: null }, { status: 400 });

  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ stats: null });

  const stats = await getChannelStats(user, channelId);
  return NextResponse.json({ stats });
}
