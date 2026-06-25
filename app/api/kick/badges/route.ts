import { NextRequest, NextResponse } from "next/server";
import { fetchKickPublic } from "@/lib/kick/public";

export const runtime = "nodejs";

// Subscriber badge art (per month-tier) for any Kick channel by slug.
export async function GET(req: NextRequest) {
  const slug = new URL(req.url).searchParams.get("slug");
  if (!slug) return NextResponse.json({ subBadges: [] });

  const pub = await fetchKickPublic(slug);
  return NextResponse.json({ subBadges: pub?.subBadges ?? [] });
}
