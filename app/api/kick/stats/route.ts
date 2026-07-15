import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getValidKickToken, kickConnection } from "@/lib/kick/client";
import { getKickStatsBySlug, getKickStatsBySlugAuthed, getKickOwnStats } from "@/lib/kick/stats";

export const runtime = "nodejs";

// Stats for a Kick channel. Pass ?slug= for any channel; when it's your own
// channel (or no slug), use the authenticated endpoint so subscriber count is
// included. For other channels, prefer the authed official API (not
// Cloudflare-blocked like the v2 endpoint) so live status is accurate.
export async function GET(req: NextRequest) {
  const slug = new URL(req.url).searchParams.get("slug");
  const user = await getCurrentUser();
  const ownSlug = user ? kickConnection(user)?.login ?? null : null;

  const isOwn = ownSlug && (!slug || slug.toLowerCase() === ownSlug.toLowerCase());
  if (isOwn && user) {
    return NextResponse.json({ stats: await getKickOwnStats(user) });
  }
  if (!slug) return NextResponse.json({ stats: null });

  // Use authed official API when possible — the v2 endpoint is Cloudflare-blocked.
  if (user) {
    const token = await getValidKickToken(user);
    if (token) {
      return NextResponse.json({ stats: await getKickStatsBySlugAuthed(slug, token) });
    }
  }

  return NextResponse.json({ stats: await getKickStatsBySlug(slug) });
}
