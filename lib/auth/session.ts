import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "crypto";
import { getUserById } from "./store";
import type { User } from "./types";

// The session cookie holds ONLY the Prismarity user id, HMAC-signed so it can't
// be tampered with. It never contains tokens.
export const SESSION_COOKIE = "prismarity_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

function sign(userId: string): string {
  const sig = createHmac("sha256", process.env.SESSION_SECRET ?? "")
    .update(userId)
    .digest("base64url");
  return `${userId}.${sig}`;
}

function verify(value: string): string | null {
  const dot = value.lastIndexOf(".");
  if (dot < 0) return null;
  const userId = value.slice(0, dot);
  const expected = sign(userId);
  const a = Buffer.from(value);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return userId;
}

// The signed cookie value to set after a successful login.
export function sessionCookieValue(userId: string): string {
  return sign(userId);
}

// httpOnly + Secure + SameSite=Lax. Secure is always on (production target);
// use a tunnel/https locally if testing the cookie path.
export const sessionCookieOptions = {
  httpOnly: true,
  secure: true,
  sameSite: "lax" as const,
  path: "/",
  maxAge: SESSION_MAX_AGE,
};

// Server helper: returns the logged-in user's identity or null.
export async function getCurrentUser(): Promise<User | null> {
  const store = await cookies();
  const raw = store.get(SESSION_COOKIE)?.value;
  if (!raw) return null;
  const userId = verify(raw);
  if (!userId) return null;
  return getUserById(userId);
}
