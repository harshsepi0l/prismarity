import { NextRequest, NextResponse } from "next/server";
import { getBeacon, setBeacon, verifyBeaconToken } from "@/lib/beacon";
import { getCurrentUser } from "@/lib/auth/session";

export const runtime = "nodejs";

// The write comes cross-origin from the browser extension and is authenticated
// by the pairing token (not the session cookie), so it needs CORS. The read is
// same-origin from the dashboard and cookie-authed, so it deliberately carries
// no CORS headers — no other origin should be able to read a user's beacon.
const WRITE_CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Beacon-Token",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: WRITE_CORS });
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({}, { status: 401 });
  return NextResponse.json(getBeacon(user.id) ?? {});
}

export async function POST(req: NextRequest) {
  const userId = await verifyBeaconToken(req.headers.get("x-beacon-token"));
  if (!userId) {
    return NextResponse.json({ ok: false }, { status: 401, headers: WRITE_CORS });
  }
  const body = (await req.json().catch(() => ({}))) as { platform?: string; channel?: string };
  if (
    (body.platform === "twitch" || body.platform === "kick") &&
    typeof body.channel === "string" &&
    body.channel.length > 0
  ) {
    setBeacon(userId, { platform: body.platform, channel: body.channel.toLowerCase(), ts: Date.now() });
  }
  return NextResponse.json({ ok: true }, { headers: WRITE_CORS });
}
