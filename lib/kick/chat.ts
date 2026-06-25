import type { User } from "@/lib/auth/types";
import { getValidKickToken, KICK_API } from "./client";

export interface SendResult {
  ok: boolean;
  error?: string;
}

// Sends a chat message to a Kick channel (by broadcaster user id) as the logged-in
// user. Token stays server-side; requires the chat:write scope.
export async function sendKickMessage(
  user: User,
  broadcasterUserId: number,
  message: string
): Promise<SendResult> {
  const token = await getValidKickToken(user);
  if (!token) return { ok: false, error: "not_connected" };

  const res = await fetch(`${KICK_API}/chat`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      broadcaster_user_id: broadcasterUserId,
      content: message,
      type: "user",
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error("[kick] send chat failed:", res.status, body);
    return {
      ok: false,
      error: res.status === 401 || res.status === 403 ? "unauthorized" : "send_failed",
    };
  }

  const json = (await res.json()) as { data?: { is_sent?: boolean } };
  if (json.data && json.data.is_sent === false) {
    return { ok: false, error: "dropped" };
  }
  return { ok: true };
}
