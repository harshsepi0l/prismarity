import type { Connection, Role, User } from "@/lib/auth/types";
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
  // Your relationship to this channel, derived server-side.
  role: Role;
}

export interface ChannelsResult {
  own: FollowedChannel | null;
  followed: FollowedChannel[];
}

interface HelixFollowed {
  broadcaster_id: string;
  broadcaster_login: string;
  broadcaster_name: string;
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

// All channels the user follows (paginated).
async function fetchFollowed(headers: Headers, userId: string): Promise<FollowedChannel[]> {
  const channels: FollowedChannel[] = [];
  let cursor: string | undefined;
  for (let page = 0; page < 30; page++) {
    const url =
      `${HELIX}/channels/followed?user_id=${userId}&first=100` +
      (cursor ? `&after=${encodeURIComponent(cursor)}` : "");
    const res = await fetch(url, { headers, cache: "no-store" });
    if (!res.ok) {
      console.error("[twitch] followed fetch failed:", res.status, await res.text());
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
        role: "viewer",
      });
    }
    cursor = json.pagination?.cursor;
    if (!cursor || (json.data?.length ?? 0) === 0) break;
  }
  return channels;
}

// IDs of channels the user moderates (paginated). Requires user:read:moderated_channels.
async function fetchModeratedIds(headers: Headers, userId: string): Promise<Set<string>> {
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

// Returns the user's own channel (role: creator) plus their followed channels,
// each tagged with the user's role (creator / moderator / viewer) and live state.
export async function getFollowedWithStatus(user: User): Promise<ChannelsResult> {
  const conn = user.connections.find((c) => c.platform === "twitch");
  if (!conn) return { own: null, followed: [] };

  const token = await getValidAccessToken(user);
  if (!token) return { own: null, followed: [] };

  const headers: Headers = {
    Authorization: `Bearer ${token}`,
    "Client-Id": process.env.TWITCH_CLIENT_ID ?? "",
  };

  const [followedRaw, moderatedIds] = await Promise.all([
    fetchFollowed(headers, conn.platformUserId),
    fetchModeratedIds(headers, conn.platformUserId),
  ]);

  // Drop your own channel from the followed list (it's surfaced separately).
  const followed = followedRaw.filter((c) => c.id !== conn.platformUserId);
  for (const c of followed) {
    c.role = moderatedIds.has(c.id) ? "moderator" : "viewer";
  }

  const own: FollowedChannel = {
    id: conn.platformUserId,
    login: conn.login,
    displayName: conn.displayName,
    isLive: false,
    viewerCount: 0,
    role: "creator",
  };

  await applyLiveStatus(headers, [own, ...followed]);

  console.log(
    `[twitch] channels: own=1 followed=${followed.length} moderated=${moderatedIds.size}`
  );

  followed.sort(
    (a, b) =>
      Number(b.isLive) - Number(a.isLive) || a.displayName.localeCompare(b.displayName)
  );

  return { own, followed };
}
