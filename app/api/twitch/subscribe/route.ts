import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import {
  subscribeToChatMessages,
  subscribeToChatNotifications,
  subscribeToRaid,
} from "@/lib/twitch/chat";

export const runtime = "nodejs";

// Called by the client right after it gets `session_welcome` on its EventSub
// WebSocket — registers both chat subscriptions against that session id so
// the same socket starts receiving messages + notifications. The token never
// leaves the server. Messages are the critical path (that's the chat read
// feature); notifications failing doesn't block "connected" — it just means
// the live gift-leaderboard tally won't populate.
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "not_logged_in" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    channelId?: string;
    sessionId?: string;
  };
  const channelId = body.channelId?.trim();
  const sessionId = body.sessionId?.trim();
  if (!channelId || !sessionId) {
    return NextResponse.json({ ok: false, error: "bad_request" }, { status: 400 });
  }

  // Chat message read is the critical path. Notifications (gift tally +
  // announcements) and incoming raids are best-effort banner sources; their
  // failure never blocks chat. (Pins + Hype Trains are read via GQL, not here.)
  const [messages, notifications, raid] = await Promise.all([
    subscribeToChatMessages(user, channelId, sessionId),
    subscribeToChatNotifications(user, channelId, sessionId),
    subscribeToRaid(user, channelId, sessionId),
  ]);

  if (!messages.ok) {
    return NextResponse.json(messages, { status: 400 });
  }
  return NextResponse.json({
    ok: true,
    notificationsOk: notifications.ok,
    raidOk: raid.ok,
  });
}
