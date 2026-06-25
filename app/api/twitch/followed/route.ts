import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getFollowedWithStatus } from "@/lib/twitch/channels";

export const runtime = "nodejs";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ channels: [] });
  const channels = await getFollowedWithStatus(user);
  return NextResponse.json({ channels });
}
