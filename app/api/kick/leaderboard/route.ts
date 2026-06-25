import { NextRequest, NextResponse } from "next/server";
import { fetchKickLeaderboard } from "@/lib/kick/public";

export const runtime = "nodejs";

// Public weekly gift leaderboard for any Kick channel by slug.
export async function GET(req: NextRequest) {
  const slug = new URL(req.url).searchParams.get("slug");
  if (!slug) return NextResponse.json({ leaders: [] });

  const leaders = await fetchKickLeaderboard(slug);
  return NextResponse.json({ leaders });
}
