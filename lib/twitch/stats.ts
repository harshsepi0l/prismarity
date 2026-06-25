import type { User } from "@/lib/auth/types";
import { getValidAccessToken } from "./channels";

const HELIX = "https://api.twitch.tv/helix";

export interface ChannelStats {
  isLive: boolean;
  viewers: number;
  startedAt: string | null;
  category: string;
  title: string;
  // Privileged (null when not permitted for this channel / not connected).
  followers: number | null;
  subs: number | null;
  chatters: number | null;
}

const EMPTY: ChannelStats = {
  isLive: false,
  viewers: 0,
  startedAt: null,
  category: "",
  title: "",
  followers: null,
  subs: null,
  chatters: null,
};

type Headers = Record<string, string>;

// Returns `total` from a Helix endpoint that reports one, or null if the call
// isn't permitted (e.g. you're not a mod/broadcaster of the channel).
async function fetchTotal(url: string, headers: Headers): Promise<number | null> {
  try {
    const res = await fetch(url, { headers, cache: "no-store" });
    if (!res.ok) return null;
    const json = (await res.json()) as { total?: number };
    return typeof json.total === "number" ? json.total : null;
  } catch {
    return null;
  }
}

export async function getChannelStats(
  user: User,
  channelId: string
): Promise<ChannelStats> {
  const conn = user.connections.find((c) => c.platform === "twitch");
  if (!conn) return EMPTY;
  const token = await getValidAccessToken(user);
  if (!token) return EMPTY;

  const headers: Headers = {
    Authorization: `Bearer ${token}`,
    "Client-Id": process.env.TWITCH_CLIENT_ID ?? "",
  };
  const ownId = conn.platformUserId;
  const stats: ChannelStats = { ...EMPTY };

  // Public stream info.
  try {
    const res = await fetch(`${HELIX}/streams?user_id=${channelId}`, {
      headers,
      cache: "no-store",
    });
    if (res.ok) {
      const json = (await res.json()) as {
        data?: { viewer_count: number; started_at: string; game_name: string; title: string }[];
      };
      const s = json.data?.[0];
      if (s) {
        stats.isLive = true;
        stats.viewers = s.viewer_count;
        stats.startedAt = s.started_at;
        stats.category = s.game_name;
        stats.title = s.title;
      }
    }
  } catch {
    /* ignore */
  }

  // Offline fallback for title/category.
  if (!stats.isLive) {
    try {
      const res = await fetch(`${HELIX}/channels?broadcaster_id=${channelId}`, {
        headers,
        cache: "no-store",
      });
      if (res.ok) {
        const json = (await res.json()) as {
          data?: { game_name: string; title: string }[];
        };
        const c = json.data?.[0];
        if (c) {
          stats.category = c.game_name;
          stats.title = c.title;
        }
      }
    } catch {
      /* ignore */
    }
  }

  // Privileged — attempt and ignore failures (Twitch authorizes by role).
  const [followers, chatters] = await Promise.all([
    fetchTotal(`${HELIX}/channels/followers?broadcaster_id=${channelId}&first=1`, headers),
    fetchTotal(
      `${HELIX}/chat/chatters?broadcaster_id=${channelId}&moderator_id=${ownId}&first=1`,
      headers
    ),
  ]);
  stats.followers = followers;
  stats.chatters = chatters;

  // Subscriptions are broadcaster-only → only your own channel.
  if (channelId === ownId) {
    stats.subs = await fetchTotal(
      `${HELIX}/subscriptions?broadcaster_id=${channelId}&first=1`,
      headers
    );
  }

  return stats;
}
