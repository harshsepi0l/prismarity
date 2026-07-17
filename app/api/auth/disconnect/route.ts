import { NextResponse } from "next/server";
import { getCurrentUser, SESSION_COOKIE } from "@/lib/auth/session";
import { removeConnection } from "@/lib/auth/store";
import type { Platform } from "@/lib/auth/types";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "not_logged_in" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_json" }, { status: 400 });
  }

  const platform = (body as Record<string, unknown>).platform;
  if (platform !== "twitch" && platform !== "kick") {
    return NextResponse.json({ error: "invalid_platform" }, { status: 400 });
  }

  const updated = await removeConnection(user.id, platform as Platform);
  const loggedOut = !updated || updated.connections.length === 0;
  const res = NextResponse.json({ ok: true, loggedOut });

  if (loggedOut) {
    res.cookies.delete(SESSION_COOKIE);
  }

  return res;
}
