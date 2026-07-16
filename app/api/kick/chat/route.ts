import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getValidKickToken, kickConnection, KICK_API } from "@/lib/kick/client";
import { sendKickMessage } from "@/lib/kick/chat";

export const runtime = "nodejs";

// Sends a chat message to a Kick channel. Target identified by slug (resolved
// server-side via the official /channels API — not Cloudflare-blocked).
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

  let broadcasterUserId: number | null = null;

  if (!body.slug) {
    // No slug → send to own channel.
    broadcasterUserId = Number(conn.platformUserId) || null;
  } else {
    // Look up the target channel's broadcaster_user_id via the official API.
    // Using GET /channels?slug= (added 2025-08-04) which is not Cloudflare-blocked.
    const token = await getValidKickToken(user);
    if (token) {
      try {
        const res = await fetch(
          `${KICK_API}/channels?slug=${encodeURIComponent(body.slug)}`,
          {
            headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
            cache: "no-store",
          }
        );
        if (res.ok) {
          const json = (await res.json()) as { data?: { broadcaster_user_id?: number }[] };
          broadcasterUserId = json.data?.[0]?.broadcaster_user_id ?? null;
        }
      } catch { /* network error */ }
    }

    // If the slug lookup returned nothing, fall back to own channel only when
    // the slug matches the authenticated user's own login.
    if (!broadcasterUserId && body.slug.toLowerCase() === (conn.login ?? "").toLowerCase()) {
      broadcasterUserId = Number(conn.platformUserId) || null;
    }
  }

  if (!broadcasterUserId) {
    return NextResponse.json({ ok: false, error: "no_channel" }, { status: 400 });
  }

  const result = await sendKickMessage(user, broadcasterUserId, message);
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
