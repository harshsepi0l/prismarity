import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getUserInfo } from "@/lib/twitch/users";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ user: null });

  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ user: null });

  const info = await getUserInfo(user, id);
  return NextResponse.json({ user: info });
}
