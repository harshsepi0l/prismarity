import { NextRequest, NextResponse } from "next/server";
import { getBeacon, setBeacon } from "@/lib/beacon";

export const runtime = "nodejs";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function GET() {
  return NextResponse.json(getBeacon() ?? {}, { headers: CORS });
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { platform?: string; channel?: string };
  if (
    (body.platform === "twitch" || body.platform === "kick") &&
    typeof body.channel === "string" &&
    body.channel.length > 0
  ) {
    setBeacon({ platform: body.platform, channel: body.channel.toLowerCase(), ts: Date.now() });
  }
  return NextResponse.json({ ok: true }, { headers: CORS });
}
