import { NextResponse } from "next/server";
import { beaconToken } from "@/lib/beacon";
import { getCurrentUser } from "@/lib/auth/session";

export const runtime = "nodejs";

// Hands the logged-in user their beacon pairing token so the Settings panel can
// display it for copy-paste into the extension. Requires a session — the token
// is derived from SESSION_SECRET server-side and never computed on the client.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ token: null }, { status: 401 });
  return NextResponse.json({ token: beaconToken(user.id) });
}
