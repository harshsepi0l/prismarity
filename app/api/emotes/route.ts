import { NextRequest, NextResponse } from "next/server";
import { getBttvEmotes } from "@/lib/emotes/bttv";
import { getFfzEmotes } from "@/lib/emotes/ffz";
import { getSevenTvEmotes } from "@/lib/emotes/seventv";

export const runtime = "nodejs";

// Aggregated third-party emotes (BTTV + FFZ + 7TV), global + the given channel.
// Twitch native emotes are handled per-message from the IRC tag, not here.
export async function GET(req: NextRequest) {
  const channelId = new URL(req.url).searchParams.get("channelId") ?? undefined;

  const [ffz, bttv, seventv] = await Promise.all([
    getFfzEmotes(channelId),
    getBttvEmotes(channelId),
    getSevenTvEmotes(channelId),
  ]);

  // Merge order = precedence on code collisions: 7TV > BTTV > FFZ.
  const emotes = { ...ffz, ...bttv, ...seventv };
  return NextResponse.json({ emotes });
}
