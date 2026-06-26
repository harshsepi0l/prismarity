import type { User } from "@/lib/auth/types";
import { getValidKickToken, kickConnection, KICK_API } from "./client";
import { fetchKickPublic, type KickChatMode } from "./public";

export type { KickChatMode };

export interface KickStats {
  channelName: string;
  profileImageUrl: string | null;
  isLive: boolean;
  viewers: number;
  startedAt: string | null;
  category: string;
  title: string;
  subs: number | null;
  followers: number | null;
  chatMode: KickChatMode | null;
}

// Stats for any Kick channel by slug (public data — used for channels you watch).
export async function getKickStatsBySlug(slug: string): Promise<KickStats | null> {
  const p = await fetchKickPublic(slug);
  if (!p) return null;
  return {
    channelName: p.displayName,
    profileImageUrl: p.profileImageUrl,
    isLive: p.isLive,
    viewers: p.viewers,
    startedAt: p.startedAt,
    category: p.category,
    title: p.title,
    subs: p.subs,
    followers: p.followers,
    chatMode: p.chatMode,
  };
}

interface KickChannel {
  slug: string;
  stream_title?: string;
  active_subscribers_count?: number;
  category?: { name?: string };
  stream?: { is_live?: boolean; viewer_count?: number; start_time?: string };
}

// Stats for the logged-in user's OWN Kick channel via the authenticated API,
// which also exposes the subscriber count (not available on the public endpoint).
export async function getKickOwnStats(user: User): Promise<KickStats | null> {
  const conn = kickConnection(user);
  if (!conn) return null;
  const token = await getValidKickToken(user);
  if (!token) return null;

  try {
    const res = await fetch(`${KICK_API}/channels`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!res.ok) {
      // Fall back to public data (no subs) if the authed call fails.
      return getKickStatsBySlug(conn.login);
    }
    const json = (await res.json()) as { data?: KickChannel[] };
    const c = json.data?.[0];
    if (!c) return getKickStatsBySlug(conn.login);

    // Followers aren't on the authed channel payload — pull from public data.
    const pub = await fetchKickPublic(c.slug);
    return {
      channelName: pub?.displayName ?? c.slug,
      profileImageUrl: pub?.profileImageUrl ?? null,
      isLive: c.stream?.is_live ?? false,
      viewers: c.stream?.viewer_count ?? 0,
      startedAt: c.stream?.start_time ?? null,
      category: c.category?.name ?? "",
      title: c.stream_title ?? "",
      subs: typeof c.active_subscribers_count === "number" ? c.active_subscribers_count : null,
      followers: pub?.followers ?? null,
      chatMode: pub?.chatMode ?? null,
    };
  } catch (e) {
    console.error("[kick] own stats error:", e instanceof Error ? e.message : e);
    return getKickStatsBySlug(conn.login);
  }
}
