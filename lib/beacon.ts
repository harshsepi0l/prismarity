import { timingSafeEqual, randomBytes } from "crypto";
import { kvGet, kvSet, kvEnabled } from "@/lib/kv";

interface BeaconState {
  platform: "twitch" | "kick";
  channel: string;
  ts: number;
}

// Beacon state + the per-user pairing secret live in the KV (Upstash), keyed by
// Prismarity user id — the only server state we keep. It has to be server-side
// (not a cookie) because the write comes from a browser extension that sends no
// session cookie, and it has to be shared (not in-memory) because serverless
// spreads requests across instances. Everything degrades to inert without a KV.
const STATE_TTL = 120; // seconds — dashboard polls every 3s; stale beacons expire
const stateKey = (userId: string) => `beacon:st:${userId}`;
const secretKey = (userId: string) => `beacon:sc:${userId}`;

export async function setBeacon(userId: string, s: BeaconState): Promise<void> {
  await kvSet(stateKey(userId), JSON.stringify(s), STATE_TTL);
}

export async function getBeacon(userId: string): Promise<BeaconState | null> {
  const raw = await kvGet(stateKey(userId));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as BeaconState;
  } catch {
    return null;
  }
}

// Pairing token: `${userId}.${beaconSecret}`. The user pastes it into the
// extension once; the extension can't send the httpOnly session cookie on its
// cross-origin POST, so this token is how a write is bound to an account.
export function buildBeaconToken(userId: string, secret: string): string {
  return `${userId}.${secret}`;
}

// Returns the user's pairing secret, minting one on first use. Null when no KV is
// configured (beacon disabled) — the pair route then hands back a null token.
export async function ensureBeaconSecret(userId: string): Promise<string | null> {
  if (!kvEnabled) return null;
  const existing = await kvGet(secretKey(userId));
  if (existing) return existing;
  const secret = randomBytes(24).toString("base64url");
  await kvSet(secretKey(userId), secret);
  return secret;
}

// Rotates the secret, invalidating any token an extension still holds.
export async function rotateBeaconSecret(userId: string): Promise<string | null> {
  if (!kvEnabled) return null;
  const secret = randomBytes(24).toString("base64url");
  await kvSet(secretKey(userId), secret);
  return secret;
}

// Returns the userId a token authenticates, or null if missing/forged/stale.
// Reads the secret from the KV by userId — works for the cookieless extension.
export async function verifyBeaconToken(token: string | null | undefined): Promise<string | null> {
  if (!token) return null;
  const dot = token.indexOf(".");
  if (dot <= 0) return null;
  const userId = token.slice(0, dot);
  const provided = token.slice(dot + 1);
  const secret = await kvGet(secretKey(userId));
  if (!secret) return null;
  const a = Buffer.from(provided);
  const b = Buffer.from(secret);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return userId;
}
