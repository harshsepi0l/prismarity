import { createHash, randomBytes } from "crypto";
import type { Connection } from "./types";
import { encrypt, decrypt } from "./crypto";
import { getSettings } from "@/lib/settings/store";

const AUTHORIZE_URL = "https://id.kick.com/oauth/authorize";
const TOKEN_URL = "https://id.kick.com/oauth/token";
const CHANNELS_URL = "https://api.kick.com/public/v1/channels";

// Scopes (request these when creating the Kick app):
//  user:read       -> identify the connected account
//  channel:read    -> channel info + stats (live, viewers, subs, category)
//  chat:write      -> send chat messages (POST /public/v1/chat)
//  events:subscribe-> reserved for reading chat via webhooks later (unused now)
export const SCOPES = [
  "user:read",
  "channel:read",
  "chat:write",
  "events:subscribe",
];

// Short-lived cookies bridging /login -> /callback. Kick OAuth requires PKCE,
// so we stash the code_verifier alongside the CSRF state.
export const STATE_COOKIE = "prismarity_kick_state";
export const VERIFIER_COOKIE = "prismarity_kick_verifier";

// PKCE pair: a high-entropy verifier and its S256 challenge.
export function makePkce(): { verifier: string; challenge: string } {
  const verifier = randomBytes(32).toString("base64url"); // 43 chars
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

// Default client ID for the shared Prismarity Kick app registration.
// Users can override via KICK_CLIENT_ID in .env.local or the settings UI.
const DEFAULT_CLIENT_ID = "01KVYDXDJ645Y6JAJ8ACC6YVN3";

// Resolves Kick OAuth credentials from the settings store, falling back to env vars.
export async function getCredentials(): Promise<{
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}> {
  const s = await getSettings();
  const clientId = s.kickClientId || process.env.KICK_CLIENT_ID || DEFAULT_CLIENT_ID;
  let clientSecret = process.env.KICK_CLIENT_SECRET || "";
  if (s.kickClientSecretEnc) {
    try {
      clientSecret = decrypt(s.kickClientSecretEnc);
    } catch {
      // Decryption failed (e.g. rotated TOKEN_ENCRYPTION_KEY) — fall back to env.
    }
  }
  const base =
    s.baseUrl || process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
  return { clientId, clientSecret, redirectUri: `${base}/api/auth/kick/callback` };
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
  });
  return `${AUTHORIZE_URL}?${params.toString()}`;
}

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  scope?: string | string[];
  token_type: string;
}

function scopeArray(scope: string | string[] | undefined): string[] {
  if (Array.isArray(scope)) return scope;
  if (typeof scope === "string") return scope.split(" ").filter(Boolean);
  return [];
}

export async function exchangeCode(
  code: string,
  verifier: string
): Promise<TokenResponse> {
  const { clientId, clientSecret, redirectUri } = await getCredentials();
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      code,
      code_verifier: verifier,
    }),
  });
  if (!res.ok) throw new Error(`kick token exchange failed: ${res.status}`);
  return (await res.json()) as TokenResponse;
}

export async function refreshToken(refresh: string): Promise<TokenResponse> {
  const { clientId, clientSecret } = await getCredentials();
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refresh,
    }),
  });
  if (!res.ok) throw new Error(`kick token refresh failed: ${res.status}`);
  return (await res.json()) as TokenResponse;
}

interface KickIdentity {
  id: string;
  slug: string;
}

// Kick has no dedicated /users endpoint; GET /channels with no params returns
// the authenticated user's own channel, which carries the id + slug.
export async function fetchIdentity(accessToken: string): Promise<KickIdentity> {
  const res = await fetch(CHANNELS_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`kick identity fetch failed: ${res.status}`);
  const json = (await res.json()) as {
    data?: { broadcaster_user_id: number; slug: string }[];
  };
  const c = json.data?.[0];
  if (!c) throw new Error("kick identity missing");
  return { id: String(c.broadcaster_user_id), slug: c.slug };
}

export function toConnection(
  token: TokenResponse,
  identity: KickIdentity
): Connection {
  return {
    platform: "kick",
    platformUserId: identity.id,
    login: identity.slug,
    displayName: identity.slug,
    accessTokenEnc: encrypt(token.access_token),
    refreshTokenEnc: encrypt(token.refresh_token),
    scope: scopeArray(token.scope),
    obtainedAt: Date.now(),
    expiresIn: token.expires_in,
  };
}
