// Kick channel data. The official API (api.kick.com/public/v1) is used when
// an access token is available — it's not Cloudflare-blocked like the unofficial
// v2 endpoint. The unofficial v2 endpoint is kept as a last-resort fallback for
// unauthenticated lookups but is blocked server-side on most hosts.
//
// Chatroom ID discovery: the official /livestreams endpoint returns channel_id,
// which equals the Pusher chatroom ID (chatrooms.{id}.v2). This is the only
// reliable server-side source for this ID.
const V2 = "https://kick.com/api/v2/channels";
const KICK_API = "https://api.kick.com/public/v1";

export interface KickSubBadgeTier {
  months: number;
  imageUrl: string;
}

export interface KickChatMode {
  followerOnly: boolean;
  followerMinutes: number; // 0 = any follower; >0 = must have followed for N minutes
  subOnly: boolean;
  slowMode: boolean;
  slowModeInterval: number;
  emotesOnly: boolean;
}

export interface KickPublic {
  slug: string;
  displayName: string;
  profileImageUrl: string | null;
  broadcasterUserId: number | null;
  chatroomId: number | null;
  isLive: boolean;
  viewers: number;
  startedAt: string | null;
  category: string;
  title: string;
  followers: number | null;
  subs: number | null;
  subBadges: KickSubBadgeTier[];
  chatMode: KickChatMode;
}

interface V2Channel {
  id?: number;
  user_id?: number;
  broadcaster_user_id?: number;
  slug?: string;
  user?: { username?: string; profile_pic?: string; profile_picture?: string };
  followers_count?: number;
  followersCount?: number;
  chatroom?: {
    id?: number;
    followers_mode?: boolean;
    followers_mode_duration?: number; // minutes you must have followed
    subscribers_mode?: boolean;
    slow_mode?: boolean;
    slow_mode_message_interval?: number;
    emotes_mode?: boolean;
  };
  subscriber_badges?: { months?: number; badge_image?: { src?: string } }[];
  livestream?: {
    is_live?: boolean;
    viewer_count?: number;
    viewers?: number;
    start_time?: string;
    created_at?: string;
    session_title?: string;
    categories?: { name?: string }[];
    category?: { name?: string };
  } | null;
}

// Shape of GET /public/v1/channels?slug= entries (works for any channel, not just own).
// Added 2025-08-04 to the official API. Used for broadcaster_user_id and chatroom ID lookup.
interface OwnChannelEntry {
  broadcaster_user_id?: number;
  slug?: string;
  stream_title?: string;
  // chatroom.id is included when the API returns it (not guaranteed — try defensively)
  chatroom?: {
    id?: number;
    followers_mode?: boolean;
    followers_mode_duration?: number;
    subscribers_mode?: boolean;
    slow_mode?: boolean;
    slow_mode_message_interval?: number;
    emotes_mode?: boolean;
  };
  chatroom_id?: number; // alternate top-level field some API versions return
  category?: { name?: string };
  stream?: { is_live?: boolean; viewer_count?: number; viewers?: number; start_time?: string };
  followers_count?: number;
  followersCount?: number;
  subscriber_count?: number;
  active_subscribers_count?: number;
  profile_picture?: string;
  profile_pic?: string;
  user?: { profile_pic?: string; profile_picture?: string };
}

// Shape of GET /public/v1/livestreams entries.
// channel_id is NOT reliably equal to chatroom.id — use /channels?slug= for authoritative chatroom ID.
interface LivestreamEntry {
  broadcaster_user_id?: number;
  channel_id?: number;
  chatroom_id?: number; // newer API versions may include this
  slug?: string;
  stream_title?: string;
  viewer_count?: number;
  started_at?: string;
  category?: { name?: string };
  profile_picture?: string;
  has_mature_content?: boolean;
}

// Paginate /livestreams until the slug is found or we exhaust all pages.
// Stops as soon as a page returns fewer items than requested (last page).
async function scanLivestreamsForSlug(
  slug: string,
  headers: Record<string, string>
): Promise<LivestreamEntry | null> {
  const LIMIT = 100;
  for (let page = 1; page <= 15; page++) {
    let entries: LivestreamEntry[] = [];
    try {
      const res = await fetch(`${KICK_API}/livestreams?page=${page}&limit=${LIMIT}`, { headers, cache: "no-store" });
      if (!res.ok) break;
      entries = ((await res.json()) as { data?: LivestreamEntry[] }).data ?? [];
    } catch { break; }
    const hit = entries.find((s) => s.slug?.toLowerCase() === slug);
    if (hit) return hit;
    if (entries.length < LIMIT) break; // last page reached
  }
  return null;
}

// Fetch channel data for any slug via the official /channels?slug= endpoint.
// Works for any channel (not just own). Returns null if the channel isn't found.
async function fetchKickChannelBySlug(
  slug: string,
  headers: Record<string, string>
): Promise<OwnChannelEntry | null> {
  try {
    const res = await fetch(`${KICK_API}/channels?slug=${encodeURIComponent(slug)}`, { headers, cache: "no-store" });
    if (!res.ok) return null;
    const json = (await res.json()) as { data?: OwnChannelEntry[] };
    return json.data?.[0] ?? null;
  } catch { return null; }
}

// Extract the most reliable chatroom ID from a channel entry. The official API
// may include it in chatroom.id or chatroom_id; both are tried defensively.
function extractChatroomId(c: OwnChannelEntry): number | null {
  return c.chatroom?.id ?? c.chatroom_id ?? null;
}

// Uses the official Kick API with the user's access token. Used server-side for
// channel metadata and live status. Attempts to get the authoritative chatroom ID
// via /channels?slug= first, then /livestreams as a fallback.
export async function fetchKickPublicAuthed(slug: string, accessToken: string): Promise<KickPublic | null> {
  const clean = slug.trim().toLowerCase().replace(/^@/, "");
  if (!clean) return null;
  try {
    const headers = { Authorization: `Bearer ${accessToken}`, Accept: "application/json" };

    // Step 1: Try /channels?slug= — works for ANY channel, and if the API exposes
    // chatroom.id here it's the authoritative Pusher chatroom ID (unlike channel_id
    // from /livestreams which has been observed to differ).
    const chanEntry = await fetchKickChannelBySlug(clean, headers);
    const officialChatroomId = chanEntry ? extractChatroomId(chanEntry) : null;

    // Step 2: scan live streams for the slug → live status + viewer count.
    const ls = await scanLivestreamsForSlug(clean, headers);
    if (ls) {
      // Prefer the official chatroom ID if we got it; fall back to channel_id from
      // livestreams as last resort (known to be wrong for some channels).
      const chatroomId = officialChatroomId ?? ls.chatroom_id ?? null;
      return {
        slug: ls.slug ?? clean,
        displayName: ls.slug ?? clean,
        profileImageUrl: ls.profile_picture ?? chanEntry?.profile_picture ?? chanEntry?.profile_pic ?? null,
        broadcasterUserId: ls.broadcaster_user_id ?? chanEntry?.broadcaster_user_id ?? null,
        chatroomId,
        isLive: true,
        viewers: ls.viewer_count ?? 0,
        startedAt: ls.started_at ?? null,
        category: ls.category?.name ?? "",
        title: ls.stream_title ?? "",
        followers: chanEntry?.followers_count ?? chanEntry?.followersCount ?? null,
        subs: null,
        subBadges: [],
        chatMode: { followerOnly: false, followerMinutes: 0, subOnly: false, slowMode: false, slowModeInterval: 0, emotesOnly: false },
      };
    }

    // Step 3: not in live streams (offline or outside all pages).
    // Use /channels?slug= result if available.
    if (chanEntry) {
      const stream = chanEntry.stream ?? null;
      return {
        slug: chanEntry.slug ?? clean,
        displayName: chanEntry.slug ?? clean,
        profileImageUrl: chanEntry.profile_picture ?? chanEntry.profile_pic ?? chanEntry.user?.profile_pic ?? chanEntry.user?.profile_picture ?? null,
        broadcasterUserId: chanEntry.broadcaster_user_id ?? null,
        chatroomId: officialChatroomId,
        isLive: stream?.is_live ?? false,
        viewers: stream?.viewer_count ?? stream?.viewers ?? 0,
        startedAt: stream?.is_live ? (stream.start_time ?? null) : null,
        category: chanEntry.category?.name ?? "",
        title: chanEntry.stream_title ?? "",
        followers: chanEntry.followers_count ?? chanEntry.followersCount ?? null,
        subs: chanEntry.active_subscribers_count ?? chanEntry.subscriber_count ?? null,
        subBadges: [],
        chatMode: {
          followerOnly: chanEntry.chatroom?.followers_mode ?? false,
          followerMinutes: chanEntry.chatroom?.followers_mode_duration ?? 0,
          subOnly: chanEntry.chatroom?.subscribers_mode ?? false,
          slowMode: chanEntry.chatroom?.slow_mode ?? false,
          slowModeInterval: chanEntry.chatroom?.slow_mode_message_interval ?? 0,
          emotesOnly: chanEntry.chatroom?.emotes_mode ?? false,
        },
      };
    }

    return null;
  } catch (e) {
    console.error("[kick] authed lookup error:", e instanceof Error ? e.message : e);
    return null;
  }
}

export async function fetchKickPublic(slug: string): Promise<KickPublic | null> {
  const clean = slug.trim().toLowerCase().replace(/^@/, "");
  if (!clean) return null;
  try {
    const res = await fetch(`${V2}/${encodeURIComponent(clean)}`, {
      headers: {
        // Kick fronts this with Cloudflare; a browser-like UA avoids bot blocks.
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
        Accept: "application/json",
      },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const c = (await res.json()) as V2Channel;
    const ls = c.livestream ?? null;
    return {
      slug: c.slug ?? clean,
      displayName: c.user?.username ?? c.slug ?? clean,
      profileImageUrl: c.user?.profile_pic ?? c.user?.profile_picture ?? null,
      broadcasterUserId: c.user_id ?? c.broadcaster_user_id ?? null,
      chatroomId: c.chatroom?.id ?? null,
      isLive: !!ls && (ls.is_live ?? true),
      viewers: ls?.viewer_count ?? ls?.viewers ?? 0,
      startedAt: ls?.start_time ?? ls?.created_at ?? null,
      category: ls?.categories?.[0]?.name ?? ls?.category?.name ?? "",
      title: ls?.session_title ?? "",
      followers: c.followers_count ?? c.followersCount ?? null,
      subs: null,
      chatMode: {
        followerOnly: c.chatroom?.followers_mode ?? false,
        followerMinutes: c.chatroom?.followers_mode_duration ?? 0,
        subOnly: c.chatroom?.subscribers_mode ?? false,
        slowMode: c.chatroom?.slow_mode ?? false,
        slowModeInterval: c.chatroom?.slow_mode_message_interval ?? 0,
        emotesOnly: c.chatroom?.emotes_mode ?? false,
      },
      subBadges: (c.subscriber_badges ?? [])
        .filter((b): b is { months: number; badge_image: { src: string } } =>
          typeof b.months === "number" && !!b.badge_image?.src
        )
        .map((b) => ({ months: b.months, imageUrl: b.badge_image.src }))
        .sort((a, b) => a.months - b.months),
    };
  } catch (e) {
    console.error("[kick] public fetch error:", e instanceof Error ? e.message : e);
    return null;
  }
}

export interface KickLeader {
  username: string;
  amount: number;
}

interface V2LeaderboardEntry {
  username?: string;
  user?: { username?: string; profile_pic?: string; profile_picture?: string };
  quantity?: number;
  gifted_amount?: number;
  amount?: number;
}

interface V2Leaderboards {
  gifts?: {
    week?: V2LeaderboardEntry[];
    weekly?: V2LeaderboardEntry[];
  };
  weekly?: V2LeaderboardEntry[];
  week?: V2LeaderboardEntry[];
}

// URL for a channel's weekly gift leaderboard on the unofficial v2 API. Shared
// so the browser can fetch it directly (passes Cloudflare) when the server IP
// is blocked.
export function kickLeaderboardUrl(slug: string): string {
  return `${V2}/${encodeURIComponent(slug.trim().toLowerCase().replace(/^@/, ""))}/leaderboards`;
}

// Parse a raw v2 leaderboards payload into the trailing-week top gifters. Field
// names are best-effort from community findings rather than a verified live
// response (this environment's IP is Cloudflare-blocked from kick.com), so the
// reads are defensive on purpose.
export function parseKickLeaderboard(raw: unknown): KickLeader[] {
  const data = (raw ?? {}) as V2Leaderboards;
  const weekly = data.gifts?.week ?? data.gifts?.weekly ?? data.week ?? data.weekly ?? [];
  return weekly
    .map((e) => ({
      username: e.username ?? e.user?.username ?? "unknown",
      amount: e.quantity ?? e.gifted_amount ?? e.amount ?? 0,
    }))
    .slice(0, 10);
}

// Top gifters for the trailing week. Hits the unofficial v2 endpoint, which is
// Cloudflare-blocked (403) from most server IPs — callers should prefer the
// browser-side path (kickLeaderboardUrl + parseKickLeaderboard) and fall back
// to this server route.
export async function fetchKickLeaderboard(slug: string): Promise<KickLeader[]> {
  const clean = slug.trim().toLowerCase().replace(/^@/, "");
  if (!clean) return [];
  try {
    const res = await fetch(kickLeaderboardUrl(clean), {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
        Accept: "application/json",
      },
      cache: "no-store",
    });
    // 403 here is the expected Cloudflare block for server-side requests; stay
    // quiet and let the browser-side path supply the data.
    if (!res.ok) return [];
    return parseKickLeaderboard(await res.json());
  } catch {
    return [];
  }
}
