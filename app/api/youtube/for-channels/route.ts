import { NextRequest, NextResponse } from "next/server";
import { getChannelSocials, findYouTubeUrl } from "@/lib/twitch/socials";
import { isYouTubeChannelLive } from "@/lib/youtube/live";

export const runtime = "nodejs";

// Enrich a batch of Twitch logins with their YouTube presence:
//   { channels: { [login]: { url: string | null, isLive: boolean } } }
// - url comes from the streamer's Twitch "About" socials (existence — cheap).
// - isLive is only computed when ?live=1 (scrapes the YouTube /live page — the
//   heavy part), so search (existence-only) never pays for it.
export async function GET(req: NextRequest) {
  const sp = new URL(req.url).searchParams;
  const logins = (sp.get("logins") ?? "")
    .split(",")
    .map((l) => l.trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 30); // cap the fan-out
  const wantLive = sp.get("live") === "1";
  if (logins.length === 0) return NextResponse.json({ channels: {} });

  const entries = await Promise.all(
    logins.map(async (login) => {
      const url = findYouTubeUrl(await getChannelSocials(login));
      const isLive = wantLive && url ? await isYouTubeChannelLive(url) : false;
      return [login, { url, isLive }] as const;
    })
  );

  return NextResponse.json({ channels: Object.fromEntries(entries) });
}
