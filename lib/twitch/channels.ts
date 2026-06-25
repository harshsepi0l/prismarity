import type { Connection, User } from "@/lib/auth/types";
import { decrypt, encrypt } from "@/lib/auth/crypto";
import { refreshToken } from "@/lib/auth/twitch";
import { upsertConnection } from "@/lib/auth/store";

const HELIX = "https://api.twitch.tv/helix";

export interface FollowedChannel {
  id: string;
  login: string;
  displayName: string;
  isLive: boolean;
  viewerCount: number;
}

interface HelixFollowed {
  broadcaster_id: string;
  broadcaster_login: string;
  broadcaster_name: string;
}

interface HelixStream {
  user_id: string;
  viewer_count: number;
}

// Returns a non-expired access token, refreshing + persisting if needed.
// Note: refreshing does NOT add scopes — granting a new scope requires re-login.
export async function getValidAccessToken(user: User): Promise<string | null> {
  const conn = user.connections.find((c) => c.platform === "twitch");
  if (!conn) return null;

  const expiresAt = conn.obtainedAt + conn.expiresIn * 1000;
  if (Date.now() < expiresAt - 60_000) {
    return decrypt(conn.accessTokenEnc);
  }

  try {
    const refreshed = await refreshToken(decrypt(conn.refreshTokenEnc));
    const updated: Connection = {
      ...conn,
      accessTokenEnc: encrypt(refreshed.access_token),
      refreshTokenEnc: encrypt(refreshed.refresh_token ?? decrypt(conn.refreshTokenEnc)),
      scope: refreshed.scope ?? conn.scope,
      obtainedAt: Date.now(),
      expiresIn: refreshed.expires_in,
    };
    await upsertConnection(updated);
    return refreshed.access_token;
  } catch {
    // Fall back to the existing token; the caller treats a 401 as "no data".
    return decrypt(conn.accessTokenEnc);
  }
}

// Fetches all of the user's followed Twitch channels and merges in live status
// + viewer counts. Returns [] on error (e.g. missing user:read:follows scope —
// the user must re-login to grant it).
export async function getFollowedWithStatus(user: User): Promise<FollowedChannel[]> {
  const conn = user.connections.find((c) => c.platform === "twitch");
  if (!conn) return [];

  const token = await getValidAccessToken(user);
  if (!token) return [];

  const headers = {
    Authorization: `Bearer ${token}`,
    "Client-Id": process.env.TWITCH_CLIENT_ID ?? "",
  };

  // Page through ALL followed channels — Helix returns up to 100 per page.
  const channels: FollowedChannel[] = [];
  let cursor: string | undefined;
  for (let page = 0; page < 30; page++) {
    const url =
      `${HELIX}/channels/followed?user_id=${conn.platformUserId}&first=100` +
      (cursor ? `&after=${encodeURIComponent(cursor)}` : "");
    const res = await fetch(url, { headers, cache: "no-store" });
    if (!res.ok) {
      // Most common cause: token lacks user:read:follows (granted only after a
      // fresh login since the scope was added). The body explains it.
      console.error("[twitch] followed fetch failed:", res.status, await res.text());
      if (page === 0) return [];
      break;
    }
    const json = (await res.json()) as {
      data?: HelixFollowed[];
      pagination?: { cursor?: string };
    };
    for (const d of json.data ?? []) {
      channels.push({
        id: d.broadcaster_id,
        login: d.broadcaster_login,
        displayName: d.broadcaster_name,
        isLive: false,
        viewerCount: 0,
      });
    }
    cursor = json.pagination?.cursor;
    if (!cursor || (json.data?.length ?? 0) === 0) break;
  }
  console.log(`[twitch] followed channels: ${channels.length}`);
  if (channels.length === 0) return [];

  // Live status + viewer counts, batched in chunks of 100 (Helix streams cap).
  for (let i = 0; i < channels.length; i += 100) {
    const chunk = channels.slice(i, i + 100);
    const params = new URLSearchParams();
    for (const c of chunk) params.append("user_id", c.id);
    const res = await fetch(`${HELIX}/streams?${params.toString()}`, {
      headers,
      cache: "no-store",
    });
    if (!res.ok) {
      console.error("[twitch] streams fetch failed:", res.status);
      continue;
    }
    const json = (await res.json()) as { data?: HelixStream[] };
    const live = new Map<string, number>();
    for (const s of json.data ?? []) live.set(s.user_id, s.viewer_count);
    for (const c of chunk) {
      const v = live.get(c.id);
      if (v !== undefined) {
        c.isLive = true;
        c.viewerCount = v;
      }
    }
  }
  console.log(`[twitch] live now: ${channels.filter((c) => c.isLive).length}`);

  // Live channels first, then alphabetical.
  channels.sort(
    (a, b) =>
      Number(b.isLive) - Number(a.isLive) || a.displayName.localeCompare(b.displayName)
  );
  return channels;
}
