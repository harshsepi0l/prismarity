// BetterTTV (BTTV) emotes. Fetched server-side so we avoid any CORS issues and
// can cache. Returns a map of emote code -> CDN image URL.
const GLOBAL_URL = "https://api.betterttv.net/3/cached/emotes/global";
const channelUrl = (twitchId: string) =>
  `https://api.betterttv.net/3/cached/users/twitch/${twitchId}`;
const cdn = (id: string) => `https://cdn.betterttv.net/emote/${id}/2x`;

interface BttvEmote {
  id: string;
  code: string;
}
interface BttvUser {
  channelEmotes?: BttvEmote[];
  sharedEmotes?: BttvEmote[];
}

export async function getBttvEmotes(
  channelId?: string
): Promise<Record<string, string>> {
  const map: Record<string, string> = {};

  // Global emotes (change rarely — cache for an hour).
  try {
    const res = await fetch(GLOBAL_URL, { next: { revalidate: 3600 } });
    if (res.ok) {
      const list = (await res.json()) as BttvEmote[];
      for (const e of list) map[e.code] = cdn(e.id);
    }
  } catch {
    /* ignore */
  }

  // Channel emotes (404 when the channel has no BTTV data — that's fine).
  if (channelId) {
    try {
      const res = await fetch(channelUrl(channelId), { next: { revalidate: 600 } });
      if (res.ok) {
        const data = (await res.json()) as BttvUser;
        for (const e of [...(data.channelEmotes ?? []), ...(data.sharedEmotes ?? [])]) {
          map[e.code] = cdn(e.id);
        }
      }
    } catch {
      /* ignore */
    }
  }

  return map;
}
