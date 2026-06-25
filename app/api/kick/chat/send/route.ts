import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { kickConnection } from "@/lib/kick/client";
import { fetchKickPublic } from "@/lib/kick/public";
import { sendKickMessage } from "@/lib/kick/chat";

export const runtime = "nodejs";

// Sends to a Kick channel by slug (resolved server-side to a broadcaster id, so
// we never trust a client-supplied id). With no slug, targets your own channel.
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "not_logged_in" }, { status: 401 });
  }
  const conn = kickConnection(user);
  if (!conn) {
    return NextResponse.json({ ok: false, error: "not_connected" }, { status: 400 });
  }

  const body = (await req.json().catch(() => ({}))) as { slug?: string; message?: string };
  const message = body.message?.trim();
  if (!message) {
    return NextResponse.json({ ok: false, error: "bad_request" }, { status: 400 });
  }

  let broadcasterUserId: number | null = Number(conn.platformUserId);
  if (body.slug) {
    const p = await fetchKickPublic(body.slug);
    broadcasterUserId = p?.broadcasterUserId ?? null;
  }
  if (!broadcasterUserId) {
    return NextResponse.json({ ok: false, error: "no_channel" }, { status: 400 });
  }

  const result = await sendKickMessage(user, broadcasterUserId, message);
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
