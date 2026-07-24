import { cookies } from "next/headers";
import { encrypt, decrypt } from "./crypto";
import type { User } from "./types";

// STATELESS SESSIONS: the whole user record (id, platform connections with their
// already-encrypted tokens, beacon secret) lives INSIDE the session cookie,
// encrypted with AES-256-GCM (see crypto.ts / TOKEN_ENCRYPTION_KEY). GCM gives
// both confidentiality and integrity, so no separate signature is needed and no
// server-side store is required — which is what lets this run on serverless
// hosts (Vercel) where the filesystem isn't writable/persistent.
export const SESSION_COOKIE = "prismarity_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

// httpOnly + Secure + SameSite=Lax. Secure is gated on production so that local
// dev over http://localhost works — a Secure cookie set over plain http is
// dropped by the browser (Safari rejects it outright), which silently breaks the
// whole login flow. In production (Vercel, https) Secure is always on.
export const COOKIE_SECURE = process.env.NODE_ENV === "production";
export const sessionCookieOptions = {
  httpOnly: true,
  secure: COOKIE_SECURE,
  sameSite: "lax" as const,
  path: "/",
  maxAge: SESSION_MAX_AGE,
};

// Cookies cap at ~4KB. Two platform connections encode to ~2.5KB encrypted — a
// third (YouTube) would get close; warn in dev so we notice before the browser
// silently drops an oversized cookie.
const COOKIE_SIZE_WARN = 3800;

// Encode the user for the cookie. Encrypted → opaque + tamper-proof to the client.
export function encodeSession(user: User): string {
  const value = encrypt(JSON.stringify(user));
  if (process.env.NODE_ENV !== "production" && value.length > COOKIE_SIZE_WARN) {
    console.warn(`[session] cookie is ${value.length}B (nearing the ~4KB limit)`);
  }
  return value;
}

// Decode the cookie back into a user, or null if missing/tampered/legacy-format.
export function decodeSession(raw: string): User | null {
  try {
    const user = JSON.parse(decrypt(raw)) as User;
    if (!user || typeof user.id !== "string" || !Array.isArray(user.connections)) return null;
    return user;
  } catch {
    return null;
  }
}

// Server helper: the logged-in user (decoded straight from the cookie), or null.
export async function getCurrentUser(): Promise<User | null> {
  const store = await cookies();
  const raw = store.get(SESSION_COOKIE)?.value;
  if (!raw) return null;
  return decodeSession(raw);
}

// Persist an updated user back to the cookie from a mutation that has no explicit
// response object to set it on — e.g. token refresh deep in a Helix helper, or a
// beacon-secret change. Only works inside Route Handlers / Server Actions; it's a
// safe no-op elsewhere (all our token refreshes run in route handlers — verified).
export async function persistSession(user: User): Promise<void> {
  try {
    (await cookies()).set(SESSION_COOKIE, encodeSession(user), sessionCookieOptions);
  } catch {
    /* not a cookie-writable context — skip; the caller still got a fresh token */
  }
}

// Clear the session (full logout).
export async function clearSession(): Promise<void> {
  try {
    (await cookies()).delete(SESSION_COOKIE);
  } catch {
    /* not a cookie-writable context */
  }
}
