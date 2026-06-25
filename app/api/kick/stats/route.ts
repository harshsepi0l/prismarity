import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { kickConnection } from "@/lib/kick/client";
import { getKickStatsBySlug, getKickOwnStats } from "@/lib/kick/stats";

export const runtime = "nodejs";

// Stats for a Kick channel. Pass ?slug= for any channel; when it's your own
// channel (or no slug), use the authenticated endpoint so subscriber count is
// included. Otherwise fall back to public data.
export async function GET(req: NextRequest) {
  const slug = new URL(req.url).searchParams.get("slug");
  const user = await getCurrentUser();
  const ownSlug = user ? kickConnection(user)?.login ?? null : null;

  const isOwn = ownSlug && (!slug || slug.toLowerCase() === ownSlug.toLowerCase());
  if (isOwn && user) {
    return NextResponse.json({ stats: await getKickOwnStats(user) });
  }
  if (!slug) return NextResponse.json({ stats: null });

  return NextResponse.json({ stats: await getKickStatsBySlug(slug) });
}
