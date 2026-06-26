import { NextResponse } from "next/server";
import { fetchKickGlobalBadges } from "@/lib/kick/global-badges";

export const runtime = "nodejs";
// Cache for 10 minutes — global badges change rarely.
export const revalidate = 600;

export async function GET() {
  const badges = await fetchKickGlobalBadges();
  return NextResponse.json({ badges });
}
