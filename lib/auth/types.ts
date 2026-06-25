// Shared auth types. Multi-platform from the start; only Twitch is implemented
// in this phase. TODO: implement YouTube and Kick connections.
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

// One Prismarity user -> many connected platform accounts.
export interface User {
  id: string;
  createdAt: number;
  connections: Connection[];
}
