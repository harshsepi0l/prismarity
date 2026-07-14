import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { helixHeaders } from "@/lib/twitch/channels";
import { sendChatMessage } from "@/lib/twitch/chat";

export const runtime = "nodejs";

export interface TwitchChatSettings {
  followerOnly: boolean;
  followerMinutes: number; // 0 = immediate, >0 = must have followed that many minutes
  subOnly: boolean;
  slowMode: boolean;
  slowModeWaitSeconds: number;
  emotesOnly: boolean;
  uniqueMode: boolean; // r9k
}

// GET /api/twitch/chat?channelId= — chat mode settings for the channel.
export async function GET(req: NextRequest) {
  const channelId = req.nextUrl.searchParams.get("channelId");
  if (!channelId) {
    return NextResponse.json({ ok: false, error: "bad_request" }, { status: 400 });
  }

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "not_logged_in" }, { status: 401 });
  }

  const headers = await helixHeaders(user);
  if (!headers) {
    return NextResponse.json({ ok: false, error: "no_token" }, { status: 401 });
  }

  const res = await fetch(
    `https://api.twitch.tv/helix/chat/settings?broadcaster_id=${channelId}`,
    { headers, cache: "no-store" }
  );

  if (!res.ok) {
    return NextResponse.json({ ok: false, error: "fetch_failed" }, { status: res.status });
  }

  const json = (await res.json()) as {
    data?: {
      follower_mode?: boolean;
      follower_mode_duration?: number | null;
      subscriber_mode?: boolean;
      slow_mode?: boolean;
      slow_mode_wait_time?: number | null;
      emote_mode?: boolean;
      unique_chat_mode?: boolean;
    }[];
  };

  const d = json.data?.[0] ?? {};
  const settings: TwitchChatSettings = {
    followerOnly: d.follower_mode ?? false,
    followerMinutes: d.follower_mode_duration ?? 0,
    subOnly: d.subscriber_mode ?? false,
    slowMode: d.slow_mode ?? false,
    slowModeWaitSeconds: d.slow_mode_wait_time ?? 0,
    emotesOnly: d.emote_mode ?? false,
    uniqueMode: d.unique_chat_mode ?? false,
  };

  return NextResponse.json({ ok: true, settings });
}

// POST /api/twitch/chat — send a chat message.
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
