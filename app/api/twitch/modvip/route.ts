import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

// Real moderator + VIP rosters for ANY Twitch channel (not just ones you own).
// Twitch's own Helix mod/VIP endpoints are broadcaster-scoped, and the GQL
// chatters field is integrity-locked — but ivr.fi, a long-standing public Twitch
// data aggregator, exposes the full mod/VIP lists with no auth. We proxy it
// server-side (avoids CORS, lets us cache — these lists change rarely).
const IVR = "https://api.ivr.fi/v2/twitch/modvip";

interface IvrUser {
  id?: string;
  login?: string;
  displayName?: string;
}

function map(list: IvrUser[] | undefined) {
  return (list ?? [])
    .filter((u) => u.displayName || u.login)
    .map((u) => ({ user: u.displayName ?? u.login!, id: u.id }));
}

export async function GET(req: NextRequest) {
  const login = new URL(req.url).searchParams.get("login");
  if (!login) return NextResponse.json({ mods: [], vips: [] });

  try {
    const res = await fetch(`${IVR}/${encodeURIComponent(login)}`, {
      // Mods/VIPs change infrequently — cache for 10 minutes per channel.
      next: { revalidate: 600 },
    });
    if (!res.ok) {
      console.warn("[twitch] modvip lookup failed:", res.status);
      return NextResponse.json({ mods: [], vips: [] });
    }
    const j = (await res.json()) as { mods?: IvrUser[]; vips?: IvrUser[] };
    return NextResponse.json({ mods: map(j.mods), vips: map(j.vips) });
  } catch {
    return NextResponse.json({ mods: [], vips: [] });
  }
}
