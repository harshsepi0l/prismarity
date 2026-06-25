import type { User } from "@/lib/auth/types";
import { getValidAccessToken } from "./channels";

const HELIX = "https://api.twitch.tv/helix";

export interface BadgeInfo {
  imageUrl: string;
  title: string;
}

interface BadgeVersion {
  id: string;
  image_url_4x: string;
  title?: string;
}
interface BadgeSet {
  set_id: string;
  versions: BadgeVersion[];
}

function flatten(sets: BadgeSet[], map: Map<string, BadgeInfo>): void {
  for (const set of sets) {
    for (const v of set.versions) {
      map.set(`${set.set_id}:${v.id}`, { imageUrl: v.image_url_4x, title: v.title ?? set.set_id });
    }
  }
}

// Real badge art (subscriber tiers, bits tiers, custom channel badges) for a
// given broadcaster — global set first, then channel-specific overrides on
// collision (e.g. a custom subscriber badge replacing the default one).
// Public data, any valid token, no special scope.
export async function getChannelBadges(
  user: User,
  channelId: string
): Promise<Record<string, BadgeInfo>> {
  const token = await getValidAccessToken(user);
  if (!token) return {};

  const headers = {
    Authorization: `Bearer ${token}`,
    "Client-Id": process.env.TWITCH_CLIENT_ID ?? "",
  };
  const map = new Map<string, BadgeInfo>();

  try {
    const [globalRes, channelRes] = await Promise.all([
      fetch(`${HELIX}/chat/badges/global`, { headers, cache: "no-store" }),
      fetch(`${HELIX}/chat/badges?broadcaster_id=${channelId}`, { headers, cache: "no-store" }),
    ]);
    if (globalRes.ok) {
      const json = (await globalRes.json()) as { data?: BadgeSet[] };
      flatten(json.data ?? [], map);
    }
    if (channelRes.ok) {
      const json = (await channelRes.json()) as { data?: BadgeSet[] };
      flatten(json.data ?? [], map); // channel sets override global on collision
    }
  } catch (e) {
    console.error("[twitch] badges fetch error:", e instanceof Error ? e.message : e);
  }

  return Object.fromEntries(map);
}
