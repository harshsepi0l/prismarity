import { NextRequest, NextResponse } from "next/server";
import { getBttvEmotes } from "@/lib/emotes/bttv";
import { getFfzEmotes } from "@/lib/emotes/ffz";
import { getSevenTvEmotes } from "@/lib/emotes/seventv";

export const revalidate = 3600; // third-party emote sets don't change mid-stream

export const runtime = "nodejs";

export type EmoteSource = "7tv" | "bttv" | "ffz";

// Aggregated third-party emotes (BTTV + FFZ + 7TV), global + the given channel.
// Twitch/Kick native emotes are handled per-message instead (fragments/[emote:]
// tags), so they aren't part of this browsable/typeable set.
export async function GET(req: NextRequest) {
  const channelId = new URL(req.url).searchParams.get("channelId") ?? undefined;

  const [ffz, bttv, seventv] = await Promise.all([
    getFfzEmotes(channelId),
    getBttvEmotes(channelId),
    getSevenTvEmotes(channelId),
  ]);

  // Merge order = precedence on code collisions: 7TV > BTTV > FFZ.
  const emotes = { ...ffz, ...bttv, ...seventv };

  // Same data, grouped by source for the picker's tabs.
  const categories: { source: EmoteSource; emotes: { code: string; url: string }[] }[] = [
    { source: "7tv", emotes: Object.entries(seventv).map(([code, url]) => ({ code, url })) },
    { source: "bttv", emotes: Object.entries(bttv).map(([code, url]) => ({ code, url })) },
    { source: "ffz", emotes: Object.entries(ffz).map(([code, url]) => ({ code, url })) },
  ];

  return NextResponse.json({ emotes, categories });
}
