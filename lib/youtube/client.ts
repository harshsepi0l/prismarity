import type { Connection, User } from "@/lib/auth/types";
import { decrypt, encrypt } from "@/lib/auth/crypto";
import { refreshToken } from "@/lib/auth/youtube";
import { upsertConnection } from "@/lib/auth/store";

export const YOUTUBE_API = "https://www.googleapis.com/youtube/v3";

// All connected YouTube channels. A user may own several (Brand Accounts), each
// connected as its own OAuth grant — one token maps to one channel.
export function youtubeConnections(user: User): Connection[] {
  return user.connections.filter((c) => c.platform === "youtube");
}

// Returns a non-expired Google access token for a SPECIFIC YouTube connection,
// refreshing + persisting if needed. Google refresh responses omit the
// refresh_token, so the existing one is preserved. upsertConnection keys by
// (platform, platformUserId), so refreshing one channel never touches another.
export async function getValidYouTubeTokenFor(conn: Connection): Promise<string | null> {
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
