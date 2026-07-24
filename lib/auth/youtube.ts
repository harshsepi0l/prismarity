import { createHash, randomBytes } from "crypto";
import type { Connection } from "./types";
import { encrypt } from "./crypto";
import { getSettings, getBaseUrl } from "@/lib/settings/store";

const AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const CHANNELS_URL = "https://www.googleapis.com/youtube/v3/channels";

// Scopes:
//  youtube.force-ssl -> read AND write. We need it to POST live-chat messages
//                       (liveChatMessages.insert); the read-only scope can't
//                       send. It still covers everything readonly did (identity,
//                       subscriber count, live status, live-chat READ), so the
//                       stats/live features are unaffected. NOTE: connections
//                       authorized under the old youtube.readonly scope must
//                       reconnect once before sending works — their token lacks
//                       the write grant and insert returns 403 until re-consent.
//
// Google issues a refresh token only when access_type=offline AND the user is
// prompted for consent, so getAuthorizeUrl forces prompt=consent (see below).
export const SCOPES = ["https://www.googleapis.com/auth/youtube.force-ssl"];

// Cookies bridging /login → /callback: CSRF state + PKCE verifier.
export const STATE_COOKIE = "prismarity_youtube_state";
export const VERIFIER_COOKIE = "prismarity_youtube_verifier";

// PKCE pair: high-entropy verifier and its S256 challenge.
export function makePkce(): { verifier: string; challenge: string } {
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

// Google has no shared default app registration (unlike Twitch/Kick) — a Google
// Cloud project with the YouTube Data API enabled is required. Set both
// YOUTUBE_CLIENT_ID and YOUTUBE_CLIENT_SECRET; Google "Web application" clients
// still require the secret at token exchange even with PKCE.
export async function getCredentials(): Promise<{
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}> {
  const s = await getSettings();
  const clientId = s.youtubeClientId || process.env.YOUTUBE_CLIENT_ID || "";
  const clientSecret = process.env.YOUTUBE_CLIENT_SECRET || "";
  const base = await getBaseUrl();
  return { clientId, clientSecret, redirectUri: `${base}/api/auth/youtube/callback` };
}

export async function getAuthorizeUrl(state: string, challenge: string): Promise<string> {
  const { clientId, redirectUri } = await getCredentials();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: SCOPES.join(" "),
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
    // access_type=offline + prompt=consent → Google returns a refresh_token
    // (only granted on an explicit consent, not on silent re-auth).
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
  });
  return `${AUTHORIZE_URL}?${params.toString()}`;
}

interface TokenResponse {
  access_token: string;
  // Absent on refresh responses — Google keeps the original refresh token.
  refresh_token?: string;
  expires_in: number;
  scope?: string;
  token_type: string;
}

function scopeArray(scope: string | undefined): string[] {
  return typeof scope === "string" ? scope.split(" ").filter(Boolean) : [];
}

export async function exchangeCode(code: string, verifier: string): Promise<TokenResponse> {
  const { clientId, clientSecret, redirectUri } = await getCredentials();
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      code_verifier: verifier,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`youtube token exchange failed: ${res.status} — ${body}`);
  }
  return (await res.json()) as TokenResponse;
}

export async function refreshToken(refresh: string): Promise<TokenResponse> {
  const { clientId, clientSecret } = await getCredentials();
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
      refresh_token: refresh,
    }),
  });
  if (!res.ok) throw new Error(`youtube token refresh failed: ${res.status}`);
  return (await res.json()) as TokenResponse;
}

interface YouTubeIdentity {
  id: string;
  title: string;
}

// The connected account's own channel — channels.list?mine=true returns it,
// carrying the channel id + display title. A Google account with no YouTube
// channel returns no items (surfaced as an error → callback fails cleanly).
export async function fetchIdentity(accessToken: string): Promise<YouTubeIdentity> {
  const res = await fetch(`${CHANNELS_URL}?part=snippet&mine=true`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`youtube identity fetch failed: ${res.status}`);
  const json = (await res.json()) as {
    items?: { id: string; snippet?: { title?: string } }[];
  };
  const c = json.items?.[0];
  if (!c) throw new Error("youtube identity missing (no channel on this account)");
  return { id: c.id, title: c.snippet?.title ?? c.id };
}

export function toConnection(
  token: TokenResponse,
  identity: YouTubeIdentity
): Connection {
  return {
    platform: "youtube",
    platformUserId: identity.id,
    login: identity.id,
    displayName: identity.title,
    accessTokenEnc: encrypt(token.access_token),
    // A missing refresh token would make this connection un-refreshable; the
    // consent-forcing authorize URL ensures Google sends one.
    refreshTokenEnc: encrypt(token.refresh_token ?? ""),
    scope: scopeArray(token.scope),
    obtainedAt: Date.now(),
    expiresIn: token.expires_in,
  };
}
