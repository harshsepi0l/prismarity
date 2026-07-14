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
  let channelPublic = null as Awaited<ReturnType<typeof fetchKickPublic>>;
  if (body.slug) {
    channelPublic = await fetchKickPublic(body.slug);
    broadcasterUserId = channelPublic?.broadcasterUserId ?? null;
  }
  if (!broadcasterUserId) {
    return NextResponse.json({ ok: false, error: "no_channel" }, { status: 400 });
  }

  const result = await sendKickMessage(user, broadcasterUserId, message);

  if (!result.ok && result.error === "unauthorized") {
    // Kick's API returns a generic 403 "Forbidden" for both missing-scope and
    // follower/subscriber-mode rejections — the body never mentions "follow".
    // Cross-check against the channel's known chatMode (already fetched above)
    // to surface the correct error to the client.
    if (channelPublic?.chatMode.followerOnly) {
      return NextResponse.json({ ok: false, error: "follower_only" }, { status: 400 });
    }
    if (channelPublic?.chatMode.subOnly) {
      return NextResponse.json({ ok: false, error: "sub_only" }, { status: 400 });
    }
  }

  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
