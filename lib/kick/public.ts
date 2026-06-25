// Unofficial Kick public channel data. Kick's official REST API doesn't expose
// a chatroom id (needed for the Pusher chat socket) or public stats for
// arbitrary channels, so we read the same v2 endpoint Kick's own web client uses.
// This is NOT a sanctioned API and its shape can change without notice — field
// reads below are defensive on purpose.
const V2 = "https://kick.com/api/v2/channels";

export interface KickSubBadgeTier {
  months: number;
  imageUrl: string;
}

export interface KickPublic {
  slug: string;
  broadcasterUserId: number | null;
  chatroomId: number | null;
  isLive: boolean;
  viewers: number;
  startedAt: string | null;
  category: string;
  title: string;
  followers: number | null;
  subs: number | null;
  // Custom subscriber badge art per month-tier, sorted ascending — pick the
  // highest tier whose `months` is <= the chatter's sub badge count.
  subBadges: KickSubBadgeTier[];
}

interface V2Channel {
  id?: number;
  user_id?: number;
  broadcaster_user_id?: number;
  slug?: string;
  followers_count?: number;
  followersCount?: number;
  chatroom?: { id?: number };
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
      broadcasterUserId: c.user_id ?? c.broadcaster_user_id ?? null,
      chatroomId: c.chatroom?.id ?? null,
      isLive: !!ls && (ls.is_live ?? true),
      viewers: ls?.viewer_count ?? ls?.viewers ?? 0,
      startedAt: ls?.start_time ?? ls?.created_at ?? null,
      category: ls?.categories?.[0]?.name ?? ls?.category?.name ?? "",
      title: ls?.session_title ?? "",
      followers: c.followers_count ?? c.followersCount ?? null,
      subs: null,
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
  user?: { username?: string };
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

// Top gifters for the trailing week, on the same unofficial v2 endpoint as
// fetchKickPublic — public, works for any channel by slug. Field names here
// are best-effort from documentation/community findings rather than a
// verified live response (this environment's IP is Cloudflare-blocked from
// kick.com entirely), so the reads are defensive on purpose; confirm the
// actual shape once this runs somewhere with normal network access.
export async function fetchKickLeaderboard(slug: string): Promise<KickLeader[]> {
  const clean = slug.trim().toLowerCase().replace(/^@/, "");
  if (!clean) return [];
  try {
    const res = await fetch(`${V2}/${encodeURIComponent(clean)}/leaderboards`, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
        Accept: "application/json",
      },
      cache: "no-store",
    });
    if (!res.ok) {
      console.error("[kick] leaderboard failed:", res.status, await res.text());
      return [];
    }
    const data = (await res.json()) as V2Leaderboards;
    const weekly = data.gifts?.week ?? data.gifts?.weekly ?? data.week ?? data.weekly ?? [];
    return weekly
      .map((e) => ({
        username: e.username ?? e.user?.username ?? "unknown",
        amount: e.quantity ?? e.gifted_amount ?? e.amount ?? 0,
      }))
      .slice(0, 10);
  } catch (e) {
    console.error("[kick] leaderboard fetch error:", e instanceof Error ? e.message : e);
    return [];
  }
}
