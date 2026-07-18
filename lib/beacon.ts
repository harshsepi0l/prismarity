import { createHmac, timingSafeEqual } from "crypto";

interface BeaconState {
  platform: "twitch" | "kick";
  channel: string;
  ts: number;
}

// State is scoped per Prismarity user, not a single process-wide slot: the
// extension authenticates each write with a pairing token that names its owner,
// and each dashboard reads only its own owner's beacon.
const _state = new Map<string, BeaconState>();

export function setBeacon(userId: string, s: BeaconState) { _state.set(userId, s); }
export function getBeacon(userId: string) { return _state.get(userId) ?? null; }

// Pairing token: `${userId}.${HMAC(SESSION_SECRET, "beacon:"+userId)}`. Same
// HMAC scheme as the session cookie (lib/auth/session.ts) but domain-separated
// with a "beacon:" prefix so a session cookie can't be replayed as a beacon
// token and vice versa. The user copies this into the extension popup once; the
// extension can't send the httpOnly session cookie from its cross-origin POST,
// so this token is how a write is bound to an account.
function payload(userId: string): string {
  return createHmac("sha256", process.env.SESSION_SECRET ?? "")
    .update(`beacon:${userId}`)
    .digest("base64url");
}

export function beaconToken(userId: string): string {
  return `${userId}.${payload(userId)}`;
}

// Returns the userId a token authenticates, or null if it's missing/forged.
export function verifyBeaconToken(token: string | null | undefined): string | null {
  if (!token) return null;
  const dot = token.lastIndexOf(".");
  if (dot < 0) return null;
  const userId = token.slice(0, dot);
  const expected = beaconToken(userId);
  const a = Buffer.from(token);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return userId;
}
