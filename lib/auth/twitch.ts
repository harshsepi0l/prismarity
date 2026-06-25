import type { Connection } from "./types";
import { encrypt } from "./crypto";

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

// Short-lived cookie holding the OAuth `state` for CSRF protection.
export const STATE_COOKIE = "prismarity_oauth_state";

export function getAuthorizeUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.TWITCH_CLIENT_ID ?? "",
    redirect_uri: process.env.TWITCH_REDIRECT_URI ?? "",
    response_type: "code",
    scope: SCOPES.join(" "),
    state,
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

export async function exchangeCode(code: string): Promise<TokenResponse> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.TWITCH_CLIENT_ID ?? "",
      client_secret: process.env.TWITCH_CLIENT_SECRET ?? "",
      code,
      grant_type: "authorization_code",
      redirect_uri: process.env.TWITCH_REDIRECT_URI ?? "",
    }),
  });
  if (!res.ok) throw new Error(`twitch token exchange failed: ${res.status}`);
  return (await res.json()) as TokenResponse;
}

// TODO: call this on access-token expiry and rotate the stored refresh token
// (Twitch may return a new one). Wire into a request-time guard once features
// start making authenticated Helix calls.
export async function refreshToken(refresh: string): Promise<TokenResponse> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.TWITCH_CLIENT_ID ?? "",
      client_secret: process.env.TWITCH_CLIENT_SECRET ?? "",
      grant_type: "refresh_token",
      refresh_token: refresh,
    }),
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
  const res = await fetch(USERS_URL, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Client-Id": process.env.TWITCH_CLIENT_ID ?? "",
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
