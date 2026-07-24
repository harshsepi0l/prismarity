import { NextRequest, NextResponse } from "next/server";
import { getChannelSocials } from "@/lib/twitch/socials";

export const runtime = "nodejs";
export const revalidate = 3600; // socials change rarely

export async function GET(req: NextRequest) {
  const login = new URL(req.url).searchParams.get("login");
  if (!login) return NextResponse.json({ socials: [] });
  return NextResponse.json({ socials: await getChannelSocials(login) });
}
