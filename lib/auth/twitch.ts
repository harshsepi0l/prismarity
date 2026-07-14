import { createHash, randomBytes } from "crypto";
import type { Connection } from "./types";
import { encrypt } from "./crypto";
import { getSettings } from "@/lib/settings/store";

const AUTHORIZE_URL = "https://id.twitch.tv/oauth2/authorize";
const TOKEN_URL = "https://id.twitch.tv/oauth2/token";
const USERS_URL = "https://api.twitch.tv/helix/users";

// Scopes:
//  user:read:follows            -> list the channels the user follows
//  user:read:chat               -> read chat via EventSub (any public channel,
//                                   same "chat is public" basis the old
//                                   anonymous IRC read relied on)
//  user:write:chat              -> send chat messages (Helix Send Chat Message)
//  user:read:moderated_channels -> channels the user moderates (role derivation)
//  moderator:read:followers     -> follower count (mod/broadcaster of a channel)
//  moderator:read:chatters      -> chatter count (mod/broadcaster of a channel)
//  channel:read:subscriptions   -> subscriber count (own channel only) and the
//                                   channel.chat.notification subscription
//                                   (gift-sub tallying, any channel)
// Identity is available with any user token. Bits/cheer data comes from the
// channel.chat.message EventSub event itself (the `cheer` field), not a
// separate bits:read-gated endpoint — so no bits scope is needed.
//
// NOTE: adding a scope here does NOT retroactively apply to already-connected
// users — refreshing a token never grants new scopes, only re-login does. Any
// account connected before user:read:chat was added must reconnect.
export const SCOPES = [
  "user:read:follows",
  "user:read:chat",
  "user:write:chat",
  "user:read:moderated_channels",
  "moderator:read:followers",
  "moderator:read:chatters",
  "channel:read:subscriptions",
];

// Cookies bridging /login → /callback: CSRF state + PKCE verifier.
export const STATE_COOKIE = "prismarity_oauth_state";
export const VERIFIER_COOKIE = "prismarity_twitch_verifier";

// PKCE pair: high-entropy verifier and its S256 challenge.
export function makePkce(): { verifier: string; challenge: string } {
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

// Default client ID for the shared Prismarity app registration.
// Users can override this via TWITCH_CLIENT_ID in .env.local or the settings UI.
const DEFAULT_CLIENT_ID = "8g3vtt850aeo1mvich6xou1db5x19a";

export async function getCredentials(): Promise<{
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}> {
  const s = await getSettings();
  const clientId = s.twitchClientId || process.env.TWITCH_CLIENT_ID || DEFAULT_CLIENT_ID;
  const clientSecret = process.env.TWITCH_CLIENT_SECRET || "";
  const base =
    s.baseUrl || process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
  return { clientId, clientSecret, redirectUri: `${base}/api/auth/twitch/callback` };
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
  scope: string[];
  token_type: string;
}

// PKCE exchange: verifier proves possession of the code_challenge sent at authorization.
// No client_secret needed.
export async function exchangeCode(code: string, verifier: string): Promise<TokenResponse> {
  const { clientId, clientSecret, redirectUri } = await getCredentials();
  const body = new URLSearchParams({
    client_id: clientId,
    code_verifier: verifier,
    code,
    grant_type: "authorization_code",
    redirect_uri: redirectUri,
  });
  if (clientSecret) body.set("client_secret", clientSecret);
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`twitch token exchange failed: ${res.status} — ${body}`);
  }
  return (await res.json()) as TokenResponse;
}

export async function refreshToken(refresh: string): Promise<TokenResponse> {
  const { clientId, clientSecret } = await getCredentials();
  const body = new URLSearchParams({
    client_id: clientId,
    grant_type: "refresh_token",
    refresh_token: refresh,
  });
  if (clientSecret) body.set("client_secret", clientSecret);
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) throw new Error(`twitch token refresh failed: ${res.status}`);
  return (await res.json()) as TokenResponse;
}

interface TwitchIdentity {
  id: string;
  login: string;
  display_name: string;
}

export async function fetchIdentity(accessToken: string): Promise<TwitchIdentity> {
  const { clientId } = await getCredentials();
  const res = await fetch(USERS_URL, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Client-Id": clientId,
    },
  });
  if (!res.ok) throw new Error(`twitch identity fetch failed: ${res.status}`);
  const json = (await res.json()) as { data?: TwitchIdentity[] };
  const u = json.data?.[0];
  if (!u) throw new Error("twitch identity missing");
  return { id: u.id, login: u.login, display_name: u.display_name };
}

// Build an encrypted Connection from a token response + identity.
export function toConnection(
  token: TokenResponse,
  identity: TwitchIdentity
): Connection {
  return {
    platform: "twitch",
    platformUserId: identity.id,
    login: identity.login,
    displayName: identity.display_name,
    accessTokenEnc: encrypt(token.access_token),
    refreshTokenEnc: encrypt(token.refresh_token),
    scope: token.scope ?? [],
    obtainedAt: Date.now(),
    expiresIn: token.expires_in,
  };
}
