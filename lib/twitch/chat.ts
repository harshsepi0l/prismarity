import type { User } from "@/lib/auth/types";
import { getValidAccessToken } from "./channels";

export interface SendResult {
  ok: boolean;
  error?: string;
}

// Sends a chat message as the logged-in user via Helix "Send Chat Message".
// Token stays server-side; requires the user:write:chat scope (re-login to grant).
export async function sendChatMessage(
  user: User,
  channelId: string,
  message: string
): Promise<SendResult> {
  const conn = user.connections.find((c) => c.platform === "twitch");
  if (!conn) return { ok: false, error: "not_connected" };

  const token = await getValidAccessToken(user);
  if (!token) return { ok: false, error: "no_token" };

  const res = await fetch("https://api.twitch.tv/helix/chat/messages", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Client-Id": process.env.TWITCH_CLIENT_ID ?? "",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      broadcaster_id: channelId,
      sender_id: conn.platformUserId,
      message,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error("[twitch] send chat failed:", res.status, body);
    // 401/403 usually means the token lacks user:write:chat (needs re-login).
    return {
      ok: false,
      error: res.status === 401 || res.status === 403 ? "unauthorized" : "send_failed",
    };
  }

  // Helix returns data: [{ message_id, is_sent, drop_reason? }].
  const json = (await res.json()) as {
    data?: { is_sent?: boolean; drop_reason?: { message?: string } }[];
  };
  const result = json.data?.[0];
  if (result && result.is_sent === false) {
    return { ok: false, error: result.drop_reason?.message ?? "dropped" };
  }
  return { ok: true };
}
