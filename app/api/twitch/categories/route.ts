import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { helixHeaders } from "@/lib/twitch/channels";

export const runtime = "nodejs";

const HELIX = "https://api.twitch.tv/helix";

// Bulk "what are these live channels playing right now": one Get Streams call
// per 100 logins already carries game_name, so this is cheap. Keyed by
// lowercased login; offline channels are simply absent. Best-effort — any
// failure yields {} so the sidebar just omits the "now playing" ticker.
export async function GET(req: NextRequest) {
  const logins = (new URL(req.url).searchParams.get("logins") ?? "")
    .split(",")
    .map((l) => l.trim().toLowerCase())
    .filter(Boolean);
  if (logins.length === 0) return NextResponse.json({ categories: {} });

  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ categories: {} });
  const headers = await helixHeaders(user);
  if (!headers) return NextResponse.json({ categories: {} });

  const categories: Record<string, { game: string }> = {};
  try {
    for (let i = 0; i < logins.length; i += 100) {
      const chunk = logins.slice(i, i + 100);
      const params = new URLSearchParams();
      for (const l of chunk) params.append("user_login", l);
      const res = await fetch(`${HELIX}/streams?${params.toString()}`, { headers, cache: "no-store" });
      if (!res.ok) continue;
      const json = (await res.json()) as { data?: { user_login: string; game_name?: string }[] };
      for (const s of json.data ?? []) {
        if (s.game_name) categories[s.user_login.toLowerCase()] = { game: s.game_name };
      }
    }
  } catch {
    /* best-effort — return whatever we gathered */
  }
  return NextResponse.json({ categories });
}
