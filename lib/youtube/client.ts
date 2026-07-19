import type { Connection, User } from "@/lib/auth/types";
import { decrypt, encrypt } from "@/lib/auth/crypto";
import { refreshToken } from "@/lib/auth/youtube";
import { upsertConnection } from "@/lib/auth/store";

export const YOUTUBE_API = "https://www.googleapis.com/youtube/v3";

// Returns a non-expired YouTube (Google) access token, refreshing + persisting
// if needed. Google refresh responses omit the refresh_token, so the existing
// one is preserved.
export async function getValidYouTubeToken(user: User): Promise<string | null> {
  const conn = user.connections.find((c) => c.platform === "youtube");
  if (!conn) return null;

  const expiresAt = conn.obtainedAt + conn.expiresIn * 1000;
  if (Date.now() < expiresAt - 60_000) {
    return decrypt(conn.accessTokenEnc);
  }

  const refresh = decrypt(conn.refreshTokenEnc);
  if (!refresh) return decrypt(conn.accessTokenEnc);

  try {
    const refreshed = await refreshToken(refresh);
    const updated: Connection = {
      ...conn,
      accessTokenEnc: encrypt(refreshed.access_token),
      refreshTokenEnc: encrypt(refreshed.refresh_token ?? refresh),
      obtainedAt: Date.now(),
      expiresIn: refreshed.expires_in,
    };
    await upsertConnection(updated);
    return refreshed.access_token;
  } catch {
    return decrypt(conn.accessTokenEnc);
  }
}

export function youtubeConnection(user: User): Connection | undefined {
  return user.connections.find((c) => c.platform === "youtube");
}
