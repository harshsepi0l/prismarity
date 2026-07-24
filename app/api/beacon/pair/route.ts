import { NextResponse } from "next/server";
import { buildBeaconToken, ensureBeaconSecret, rotateBeaconSecret } from "@/lib/beacon";
import { getCurrentUser } from "@/lib/auth/session";

export const runtime = "nodejs";

// GET hands the logged-in user their current beacon pairing token (minting the
// backing secret on first use). POST rotates the secret, invalidating any token
// an extension still holds — the user must re-paste the new key. Both require a
// session; the token is never derivable on the client.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ token: null }, { status: 401 });
  const secret = await ensureBeaconSecret(user.id);
  if (!secret) return NextResponse.json({ token: null }, { status: 401 });
  return NextResponse.json({ token: buildBeaconToken(user.id, secret) });
}

export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ token: null }, { status: 401 });
  const secret = await rotateBeaconSecret(user.id);
  if (!secret) return NextResponse.json({ token: null }, { status: 401 });
  return NextResponse.json({ token: buildBeaconToken(user.id, secret) });
}
