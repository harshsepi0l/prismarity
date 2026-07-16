import { NextRequest, NextResponse } from "next/server";
import { fetchKickPublic } from "@/lib/kick/public";
import { fetchKickGlobalBadges } from "@/lib/kick/global-badges";

export const runtime = "nodejs";
export const revalidate = 86400; // badge data changes rarely

// GET /api/kick/badges?slug=  — subscriber badge tiers for a channel.
// GET /api/kick/badges        — global level/role badges (no slug).
export async function GET(req: NextRequest) {
  const slug = new URL(req.url).searchParams.get("slug");

  if (!slug) {
    const badges = await fetchKickGlobalBadges();
    return NextResponse.json({ badges });
  }

  const pub = await fetchKickPublic(slug);
  return NextResponse.json({ subBadges: pub?.subBadges ?? [] });
}
