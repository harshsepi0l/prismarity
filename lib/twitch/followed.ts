import type { User } from "@/lib/auth/types";
import { helixHeaders } from "./channels";

const HELIX = "https://api.twitch.tv/helix";
const MAX_PAGES = 5; // up to 500 follows

export interface FollowedHit {
  id: string;
  login: string;
  displayName: string;
  isLive: boolean;
  viewers: number;
}

// Channels the user follows on Twitch, with live status.
//
// Requires the user:read:follows scope. Users who connected before that scope
// was added won't have it — Helix then returns 401 and we simply yield [] (a
// re-login grants it; refreshing a token never adds scopes).
export async function getFollowedTwitch(user: User): Promise<FollowedHit[]> {
  const conn = user.connections.find((c) => c.platform === "twitch");
  if (!conn) return [];
  const headers = await helixHeaders(user);
  if (!headers) return [];

  // Page through /channels/followed.
  const follows: { id: string; login: string; displayName: string }[] = [];
  let cursor: string | undefined;
  try {
    for (let page = 0; page < MAX_PAGES; page++) {
      const params = new URLSearchParams({ user_id: conn.platformUserId, first: "100" });
      if (cursor) params.set("after", cursor);
      const res = await fetch(`${HELIX}/channels/followed?${params.toString()}`, { headers, cache: "no-store" });
      if (!res.ok) break;
      const json = (await res.json()) as {
        data?: { broadcaster_id: string; broadcaster_login: string; broadcaster_name: string }[];
        pagination?: { cursor?: string };
      };
      for (const d of json.data ?? []) {
        follows.push({ id: d.broadcaster_id, login: d.broadcaster_login, displayName: d.broadcaster_name });
      }
      cursor = json.pagination?.cursor;
      if (!cursor) break;
    }
  } catch (e) {
    console.error("[twitch] followed fetch error:", e instanceof Error ? e.message : e);
    return [];
  }

  if (follows.length === 0) return [];

  // Live status + viewer counts via /streams (100 ids per call).
  const viewersById = new Map<string, number>();
  for (let i = 0; i < follows.length; i += 100) {
    const chunk = follows.slice(i, i + 100);
    const params = chunk.map((f) => `user_id=${f.id}`).join("&");
    try {
      const res = await fetch(`${HELIX}/streams?${params}&first=100`, { headers, cache: "no-store" });
      if (!res.ok) continue;
      const json = (await res.json()) as { data?: { user_id: string; viewer_count: number }[] };
      for (const s of json.data ?? []) viewersById.set(s.user_id, s.viewer_count);
    } catch {
      /* ignore a bad page */
    }
  }

  return follows.map((f) => ({
    id: f.id,
    login: f.login,
    displayName: f.displayName,
    isLive: viewersById.has(f.id),
    viewers: viewersById.get(f.id) ?? 0,
  }));
}
