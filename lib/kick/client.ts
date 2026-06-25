import type { Connection, User } from "@/lib/auth/types";
import { decrypt, encrypt } from "@/lib/auth/crypto";
import { refreshToken } from "@/lib/auth/kick";
import { upsertConnection } from "@/lib/auth/store";

export const KICK_API = "https://api.kick.com/public/v1";

// Returns a non-expired Kick access token, refreshing + persisting if needed.
export async function getValidKickToken(user: User): Promise<string | null> {
  const conn = user.connections.find((c) => c.platform === "kick");
  if (!conn) return null;

  const expiresAt = conn.obtainedAt + conn.expiresIn * 1000;
  if (Date.now() < expiresAt - 60_000) {
    return decrypt(conn.accessTokenEnc);
  }

  try {
    const refreshed = await refreshToken(decrypt(conn.refreshTokenEnc));
    const updated: Connection = {
      ...conn,
      accessTokenEnc: encrypt(refreshed.access_token),
      refreshTokenEnc: encrypt(refreshed.refresh_token ?? decrypt(conn.refreshTokenEnc)),
      obtainedAt: Date.now(),
      expiresIn: refreshed.expires_in,
    };
    await upsertConnection(updated);
    return refreshed.access_token;
  } catch {
    return decrypt(conn.accessTokenEnc);
  }
}

export function kickConnection(user: User): Connection | undefined {
  return user.connections.find((c) => c.platform === "kick");
}
