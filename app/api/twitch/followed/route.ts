import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getFollowedTwitch } from "@/lib/twitch/followed";
import { getUsersByIds } from "@/lib/twitch/users";
import { helixHeaders, fetchModeratedIds } from "@/lib/twitch/channels";
import { fetchKickPublic, fetchKickPublicAuthed } from "@/lib/kick/public";
import { getValidKickToken } from "@/lib/kick/client";
import type { SearchResult } from "@/app/(dashboard)/types";

export const runtime = "nodejs";

// Show at most this many followed channels, live ones first.
const MAX = 100;
// Probe Kick for at most this many (top, live-first) to bound cross-platform
// lookups — Kick has no follows API, so each is a per-handle channel probe.
const KICK_PROBES = 24;

// The user's followed Twitch channels as unified SearchResults. Each is
// cross-linked to Kick when the same handle exists there. Being followed on
// Twitch says nothing about Kick posting rights — the composer's reactive
// follower-only flow governs sending.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ results: [] });

  const follows = await getFollowedTwitch(user);
  if (follows.length === 0) return NextResponse.json({ results: [] });

  // Live channels first, then by viewers; cap for display.
  const top = [...follows]
    .sort((a, b) => Number(b.isLive) - Number(a.isLive) || b.viewers - a.viewers)
    .slice(0, MAX);

  // Avatars for the capped set + the user's role per channel.
  const conn = user.connections.find((c) => c.platform === "twitch");
  const [infos, headers] = await Promise.all([
    getUsersByIds(user, top.map((f) => f.id)),
    helixHeaders(user),
  ]);
  const avatarById = new Map(infos.map((u) => [u.id, u.profileImageUrl]));
  const moderated = headers && conn ? await fetchModeratedIds(headers, conn.platformUserId) : new Set<string>();

  // Best-effort Kick cross-link for the top handles.
  const kickToken = await getValidKickToken(user);
  const probe = kickToken
    ? (s: string) => fetchKickPublicAuthed(s, kickToken)
    : (s: string) => fetchKickPublic(s);
  const probed = await Promise.all(top.slice(0, KICK_PROBES).map((f) => probe(f.login.toLowerCase())));
  const kickByHandle = new Map<string, SearchResult["kick"]>();
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

  const results: SearchResult[] = top.map((f) => {
    const handle = f.login.toLowerCase();
    const avatar = avatarById.get(f.id) ?? null;
    const kick = kickByHandle.get(handle) ?? null;
    const role = conn && f.id === conn.platformUserId ? "creator" : moderated.has(f.id) ? "moderator" : "viewer";
    return {
      handle,
      displayName: f.displayName,
      profileImageUrl: avatar ?? kick?.profileImageUrl ?? null,
      twitch: { id: f.id, login: f.login, displayName: f.displayName, profileImageUrl: avatar, isLive: f.isLive, role },
      kick,
    };
  });

  return NextResponse.json({ results });
}
