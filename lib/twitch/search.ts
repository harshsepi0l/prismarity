import type { Role, User } from "@/lib/auth/types";
import { getValidAccessToken, fetchModeratedIds } from "./channels";

const HELIX = "https://api.twitch.tv/helix";

export interface TwitchSearchHit {
  id: string;
  login: string;
  displayName: string;
  isLive: boolean;
  role: Role;
}

interface HelixSearchChannel {
  id: string;
  broadcaster_login: string;
  display_name: string;
  is_live: boolean;
}

// Searches Twitch channels by name (Helix search/channels). Tags each hit with
// the user's role for it: their own channel = creator, a moderated channel =
// moderator, else viewer.
export async function searchTwitchChannels(
  user: User,
  query: string
): Promise<TwitchSearchHit[]> {
  const conn = user.connections.find((c) => c.platform === "twitch");
  if (!conn) return [];
  const token = await getValidAccessToken(user);
  if (!token) return [];

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    "Client-Id": process.env.TWITCH_CLIENT_ID ?? "",
  };

  try {
    const res = await fetch(
      `${HELIX}/search/channels?query=${encodeURIComponent(query)}&first=8`,
      { headers, cache: "no-store" }
    );
    if (!res.ok) {
      console.error("[twitch] search failed:", res.status);
      return [];
    }
    const json = (await res.json()) as { data?: HelixSearchChannel[] };
    const hits = json.data ?? [];
    if (hits.length === 0) return [];

    const ownId = conn.platformUserId;
    const moderated = await fetchModeratedIds(headers, ownId);

    return hits.map((d) => ({
      id: d.id,
      login: d.broadcaster_login,
      displayName: d.display_name,
      isLive: d.is_live,
      role: d.id === ownId ? "creator" : moderated.has(d.id) ? "moderator" : "viewer",
    }));
  } catch (e) {
    console.error("[twitch] search error:", e instanceof Error ? e.message : e);
    return [];
  }
}
