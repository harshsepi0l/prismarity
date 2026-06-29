import { NextRequest, NextResponse } from "next/server";
import { getBttvEmotes } from "@/lib/emotes/bttv";
import { getFfzEmotes } from "@/lib/emotes/ffz";
import { getSevenTvEmotes } from "@/lib/emotes/seventv";
import { getTwitchChannelEmotes } from "@/lib/emotes/twitch";
import { getCurrentUser } from "@/lib/auth/session";
import { getValidAccessToken } from "@/lib/twitch/channels";
import { getCredentials } from "@/lib/auth/twitch";

export const runtime = "nodejs";

export type EmoteSource = "7tv" | "bttv" | "ffz" | "twitch-channel";

export async function GET(req: NextRequest) {
  const channelId = new URL(req.url).searchParams.get("channelId") ?? undefined;

  const [ffz, bttv, seventv] = await Promise.all([
    getFfzEmotes(channelId),
    getBttvEmotes(channelId),
    getSevenTvEmotes(channelId),
  ]);

  // Merge order = precedence on code collisions: 7TV > BTTV > FFZ.
  const emotes: Record<string, string> = { ...ffz, ...bttv, ...seventv };

  const categories: { source: EmoteSource; emotes: { code: string; url: string; locked?: boolean }[] }[] = [
    { source: "7tv", emotes: Object.entries(seventv).map(([code, url]) => ({ code, url })) },
    { source: "bttv", emotes: Object.entries(bttv).map(([code, url]) => ({ code, url })) },
    { source: "ffz", emotes: Object.entries(ffz).map(([code, url]) => ({ code, url })) },
  ];

  // Twitch channel emotes require auth. They're normally delivered per-message
  // via nativeEmotes but fetching them server-side lets the picker show them all
  // (including sub-only ones with a lock) and makes them renderable in chat.
  if (channelId) {
    const user = await getCurrentUser();
    if (user) {
      const [token, { clientId }] = await Promise.all([
        getValidAccessToken(user),
        getCredentials(),
      ]);
      if (token) {
        const twitchEmotes = await getTwitchChannelEmotes(channelId, token, clientId);
        if (twitchEmotes.length > 0) {
          for (const e of twitchEmotes) emotes[e.code] = e.url;
          categories.push({ source: "twitch-channel", emotes: twitchEmotes });
        }
      }
    }
  }

  return NextResponse.json({ emotes, categories });
}
