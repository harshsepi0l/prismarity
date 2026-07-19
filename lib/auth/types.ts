// Shared auth types. Multi-platform: Twitch, Kick and YouTube are all
// implemented (YouTube read-only — live status + subscriber count, no chat yet).
export type Platform = "twitch" | "youtube" | "kick";

// Role is PER CHANNEL and DERIVED server-side — never chosen by the client.
export type Role = "creator" | "moderator" | "viewer";

export interface Connection {
  platform: Platform;
  platformUserId: string;
  login: string;
  displayName: string;
  // Tokens are stored ENCRYPTED at rest (AES-256-GCM). Never decrypt these into
  // anything that reaches the browser, and never log them.
  accessTokenEnc: string;
  refreshTokenEnc: string;
  scope: string[];
  obtainedAt: number; // ms epoch when the tokens were issued
  expiresIn: number; // seconds until the access token expires
}

// One Prismarity user -> many connected platform accounts. The whole record is
// serialised into the encrypted session cookie (see lib/auth/session.ts).
export interface User {
  id: string;
  createdAt: number;
  connections: Connection[];
}
