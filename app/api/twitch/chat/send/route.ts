import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { sendChatMessage } from "@/lib/twitch/chat";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "not_logged_in" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    channelId?: string;
    message?: string;
  };
  const channelId = body.channelId?.trim();
  const message = body.message?.trim();
  if (!channelId || !message) {
    return NextResponse.json({ ok: false, error: "bad_request" }, { status: 400 });
  }

  const result = await sendChatMessage(user, channelId, message);
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
