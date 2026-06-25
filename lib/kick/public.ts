// Unofficial Kick public channel data. Kick's official REST API doesn't expose
// a chatroom id (needed for the Pusher chat socket) or public stats for
// arbitrary channels, so we read the same v2 endpoint Kick's own web client uses.
// This is NOT a sanctioned API and its shape can change without notice — field
// reads below are defensive on purpose.
const V2 = "https://kick.com/api/v2/channels";

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
}

interface V2Channel {
  id?: number;
  user_id?: number;
  broadcaster_user_id?: number;
  slug?: string;
  followers_count?: number;
  followersCount?: number;
  chatroom?: { id?: number };
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
    };
  } catch (e) {
    console.error("[kick] public fetch error:", e instanceof Error ? e.message : e);
    return null;
  }
}
