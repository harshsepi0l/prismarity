import { randomUUID } from "crypto";
import type { Connection, Platform, User } from "./types";
import { getCurrentUser, persistSession } from "./session";

// STATELESS store: there is no server-side database. "The user" is whatever the
// current request's session cookie decodes to (see session.ts) — every mutation
// reads that user, changes it, and either writes it straight back to the cookie
// (persistSession) or returns it for the route handler to set on its response.
//
// Consequence: this is single-user-per-browser. Connections merged by
// (platform, platformUserId); re-login on the same platform replaces its entry,
// a new platform is added to the same session user.

function mergeConnection(user: User, conn: Connection): User {
  const idx = user.connections.findIndex(
    (c) => c.platform === conn.platform && c.platformUserId === conn.platformUserId
  );
  const connections = [...user.connections];
  if (idx >= 0) connections[idx] = conn;
  else connections.push(conn);
  return { ...user, connections };
}

function newUser(): User {
  return { id: randomUUID(), createdAt: Date.now(), connections: [] };
}

// Merge a connection into the current session user (or start a fresh user).
// Does NOT write the cookie — the OAuth callback sets it on its redirect
// response. The session cookie is the source of truth for "current user".
export async function attachConnection(conn: Connection): Promise<User> {
  const current = await getCurrentUser();
  return mergeConnection(current ?? newUser(), conn);
}

// Same merge, but persists to the cookie directly — used by the token-refresh
// path (getValidAccessToken), which runs deep inside a Route Handler with no
// response object of its own to set the cookie on.
export async function upsertConnection(conn: Connection): Promise<User> {
  const current = await getCurrentUser();
  const user = mergeConnection(current ?? newUser(), conn);
  await persistSession(user);
  return user;
}

// Remove a platform connection from the current session user. Returns the updated
// user (or null if not logged in). Does NOT write the cookie — the disconnect
// route sets/deletes it on its response.
//
// When `platformUserId` is given, only that specific connection is removed —
// needed for YouTube, where a user can connect several channels of the same
// platform. Without it, ALL connections of the platform are removed (Twitch/Kick
// only ever have one, so this is their normal path).
export async function removeConnection(
  _userId: string,
  platform: Platform,
  platformUserId?: string
): Promise<User | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  const connections = user.connections.filter((c) =>
    platformUserId != null
      ? !(c.platform === platform && c.platformUserId === platformUserId)
      : c.platform !== platform
  );
  return { ...user, connections };
}

// (Beacon pairing secret now lives in the KV, keyed by user id — see lib/beacon.ts.
// It can't live in the cookie: the extension that verifies against it sends no
// session cookie.)
