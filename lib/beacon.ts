import { timingSafeEqual } from "crypto";
import { getBeaconSecret } from "@/lib/auth/store";

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

// Pairing token: `${userId}.${beaconSecret}`, where beaconSecret is a random
// per-user value persisted in the user record (lib/auth/store). The user copies
// this into the extension popup once; the extension can't send the httpOnly
// session cookie from its cross-origin POST, so this token is how a write is
// bound to an account. Rotating the secret invalidates every prior token.
export function buildBeaconToken(userId: string, secret: string): string {
  return `${userId}.${secret}`;
}

// Returns the userId a token authenticates, or null if it's missing/forged/stale.
export async function verifyBeaconToken(token: string | null | undefined): Promise<string | null> {
  if (!token) return null;
  const dot = token.indexOf(".");
  if (dot <= 0) return null;
  const userId = token.slice(0, dot);
  const provided = token.slice(dot + 1);
  const secret = await getBeaconSecret(userId);
  if (!secret) return null;
  const a = Buffer.from(provided);
  const b = Buffer.from(secret);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return userId;
}
