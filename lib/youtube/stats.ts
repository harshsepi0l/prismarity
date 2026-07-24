import type { User } from "@/lib/auth/types";
import { getValidYouTubeToken, youtubeConnection, YOUTUBE_API } from "./client";

// Only the two features we support so far: is the channel live, and how many
// subscribers it has. `subscribers` is deliberately surfaced as the follow-
// equivalent (mapped into PlatformLive.followers) — YouTube "subscribers" are
// the free follow relationship, not paid subs.
export interface YouTubeStats {
  channelId: string;
  channelName: string;
  profileImageUrl: string | null;
  isLive: boolean;
  subscribers: number | null;
}

// Stats for the logged-in user's OWN YouTube channel. There's no "watch an
// arbitrary channel" flow for YouTube (no chat yet), so this is always the
// connected account's own channel.
export async function getYouTubeOwnStats(user: User): Promise<YouTubeStats | null> {
  const conn = youtubeConnection(user);
  if (!conn) return null;
  const token = await getValidYouTubeToken(user);
  if (!token) return null;
  const headers = { Authorization: `Bearer ${token}` };

  const stats: YouTubeStats = {
    channelId: conn.platformUserId,
    channelName: conn.displayName,
    profileImageUrl: null,
    isLive: false,
    subscribers: null,
  };

  // Identity + subscriber count in one call.
  try {
    const res = await fetch(
      `${YOUTUBE_API}/channels?part=snippet,statistics&mine=true`,
      { headers, cache: "no-store" }
    );
    if (res.ok) {
      const json = (await res.json()) as {
        items?: {
          snippet?: { title?: string; thumbnails?: { default?: { url?: string }; medium?: { url?: string } } };
          statistics?: { subscriberCount?: string; hiddenSubscriberCount?: boolean };
        }[];
      };
      const c = json.items?.[0];
      if (c) {
        stats.channelName = c.snippet?.title ?? stats.channelName;
        stats.profileImageUrl =
          c.snippet?.thumbnails?.medium?.url ?? c.snippet?.thumbnails?.default?.url ?? null;
        // subscriberCount is a string; absent when the creator hides it.
        const raw = c.statistics?.subscriberCount;
        if (!c.statistics?.hiddenSubscriberCount && raw != null) {
          const n = Number(raw);
          if (Number.isFinite(n)) stats.subscribers = n;
        }
      }
    }
  } catch {
    /* ignore — leave defaults */
  }

  // Live status: an active liveBroadcast on the authenticated channel. Returns
  // 403 for accounts that never enabled live streaming — treat that as offline.
  try {
    const res = await fetch(
      `${YOUTUBE_API}/liveBroadcasts?part=id&broadcastStatus=active&broadcastType=all&mine=true&maxResults=1`,
      { headers, cache: "no-store" }
    );
    if (res.ok) {
      const json = (await res.json()) as { items?: unknown[] };
      stats.isLive = (json.items?.length ?? 0) > 0;
    }
  } catch {
    /* ignore — leave isLive false */
  }

  return stats;
}
