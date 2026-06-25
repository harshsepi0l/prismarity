import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getOwnChannel } from "@/lib/twitch/channels";

export const runtime = "nodejs";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ own: null });
  const own = await getOwnChannel(user);
  return NextResponse.json({ own });
}
