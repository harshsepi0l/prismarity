import type { Connection, Role, User } from "@/lib/auth/types";
import { decrypt, encrypt } from "@/lib/auth/crypto";
import { refreshToken, getCredentials } from "@/lib/auth/twitch";
import { upsertConnection } from "@/lib/auth/store";

const HELIX = "https://api.twitch.tv/helix";

export interface FollowedChannel {
  id: string;
  login: string;
  displayName: string;
  profileImageUrl: string | null;
  isLive: boolean;
  viewerCount: number;
  // Your relationship to this channel, derived server-side.
  role: Role;
}

interface HelixModerated {
  broadcaster_id: string;
}

interface HelixStream {
  user_id: string;
  viewer_count: number;
}

type Headers = Record<string, string>;

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
    return decrypt(conn.accessTokenEnc);
  }
}

// Returns Authorization + Client-Id headers for Helix calls, or null if the
// user has no valid Twitch token.
export async function helixHeaders(user: User): Promise<Record<string, string> | null> {
  const [token, { clientId }] = await Promise.all([
    getValidAccessToken(user),
    getCredentials(),
  ]);
  if (!token) return null;
  return { Authorization: `Bearer ${token}`, "Client-Id": clientId };
}

// IDs of channels the user moderates (paginated). Requires user:read:moderated_channels.
export async function fetchModeratedIds(headers: Headers, userId: string): Promise<Set<string>> {
  const ids = new Set<string>();
  let cursor: string | undefined;
  for (let page = 0; page < 20; page++) {
    const url =
      `${HELIX}/moderation/channels?user_id=${userId}&first=100` +
      (cursor ? `&after=${encodeURIComponent(cursor)}` : "");
    const res = await fetch(url, { headers, cache: "no-store" });
    if (!res.ok) {
      console.error("[twitch] moderated fetch failed:", res.status);
      break;
    }
    const json = (await res.json()) as {
      data?: HelixModerated[];
      pagination?: { cursor?: string };
    };
    for (const d of json.data ?? []) ids.add(d.broadcaster_id);
    cursor = json.pagination?.cursor;
    if (!cursor || (json.data?.length ?? 0) === 0) break;
  }
  return ids;
}

// Marks live status + viewer counts on the given channels (chunks of 100).
async function applyLiveStatus(headers: Headers, channels: FollowedChannel[]): Promise<void> {
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
}

// Just the user's own channel (role: creator) with live status — used to pin
// "YOUR CHANNEL" without paginating the whole follow list.
export async function getOwnChannel(user: User): Promise<FollowedChannel | null> {
  const conn = user.connections.find((c) => c.platform === "twitch");
  if (!conn) return null;
  const headers = await helixHeaders(user);
  if (!headers) return null;

  const own: FollowedChannel = {
    id: conn.platformUserId,
    login: conn.login,
    displayName: conn.displayName,
    profileImageUrl: null,
    isLive: false,
    viewerCount: 0,
    role: "creator",
  };
  // Profile image for the sidebar avatar (own login → helix users).
  try {
    const res = await fetch(`${HELIX}/users?id=${conn.platformUserId}`, { headers, cache: "no-store" });
    if (res.ok) {
      const json = (await res.json()) as { data?: { profile_image_url?: string }[] };
      own.profileImageUrl = json.data?.[0]?.profile_image_url ?? null;
    }
  } catch {
    /* non-fatal — falls back to a placeholder initial */
  }
  await applyLiveStatus(headers, [own]);
  return own;
}
