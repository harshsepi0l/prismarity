import { NextRequest, NextResponse } from "next/server";
import { fetchBannerState } from "@/lib/twitch/banner";

export const runtime = "nodejs";

// GET /api/twitch/banner?channelId= — the channel's current pinned message and
// active Hype Train, read from Twitch's anonymous GraphQL. Works for ANY
// channel with no auth/scope, so there's no login check here.
export async function GET(req: NextRequest) {
  const channelId = req.nextUrl.searchParams.get("channelId")?.trim();
  if (!channelId) {
    return NextResponse.json({ pin: null, hypeTrain: null, hypeIncoming: null });
  }
  const state = await fetchBannerState(channelId);
  return NextResponse.json(state);
}
