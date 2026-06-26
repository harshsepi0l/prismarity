import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { searchTwitchChannels } from "@/lib/twitch/search";
import { fetchKickPublic } from "@/lib/kick/public";
import type { SearchResult } from "@/app/(dashboard)/chat/types";

export const runtime = "nodejs";

// Unified streamer search: Twitch channels via Helix search, Kick presence by
// probing the handle (Kick has no real search API). Results are merged by name
// so a streamer on both platforms shows as one row with both logos.
export async function GET(req: NextRequest) {
  const q = (new URL(req.url).searchParams.get("q") ?? "").trim();
  if (!q) return NextResponse.json({ results: [] });

  const user = await getCurrentUser();
  const twitchHits = user ? await searchTwitchChannels(user, q) : [];

  // Probe Kick for the query + each Twitch hit's handle (capped to limit calls).
  const candidates = [
    ...new Set([q.toLowerCase(), ...twitchHits.map((h) => h.login.toLowerCase())]),
  ].slice(0, 6);
  const probed = await Promise.all(candidates.map((s) => fetchKickPublic(s)));
  const kickByHandle = new Map<string, { slug: string; profileImageUrl: string | null; isLive: boolean; viewers: number; chatroomId: number | null }>();
  for (const p of probed) {
    if (p) {
      kickByHandle.set(p.slug.toLowerCase(), {
        slug: p.slug,
        profileImageUrl: p.profileImageUrl,
        isLive: p.isLive,
        viewers: p.viewers,
        chatroomId: p.chatroomId,
      });
    }
  }

  const results: SearchResult[] = [];
  const seen = new Set<string>();

  for (const h of twitchHits) {
    const handle = h.login.toLowerCase();
    seen.add(handle);
    const kick = kickByHandle.get(handle) ?? null;
    results.push({
      handle,
      displayName: h.displayName,
      profileImageUrl: h.profileImageUrl ?? kick?.profileImageUrl ?? null,
      twitch: { id: h.id, login: h.login, displayName: h.displayName, profileImageUrl: h.profileImageUrl, isLive: h.isLive, role: h.role },
      kick,
    });
  }

  // A Kick channel matching the raw query with no Twitch counterpart.
  const qh = q.toLowerCase();
  const kq = kickByHandle.get(qh);
  if (kq && !seen.has(qh)) {
    results.push({ handle: qh, displayName: kq.slug, profileImageUrl: kq.profileImageUrl, twitch: null, kick: kq });
  }

  return NextResponse.json({ results });
}
