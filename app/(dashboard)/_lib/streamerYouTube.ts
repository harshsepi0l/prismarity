// The single place that knows how to find a streamer's YouTube channel from
// their Twitch About-panel social links (GQL, via /api/twitch/socials). Shared
// by TopBar (the YouTube icon/link) and the chat context (tuned-chat resolution)
// so the match heuristic lives in exactly one spot.
//
// Returns the YouTube URL, or null when the streamer has no YouTube link.
// THROWS on a network/HTTP failure so callers can distinguish "no YouTube"
// (definitive → clear) from "couldn't check right now" (transient → keep last).
export async function fetchStreamerYouTubeUrl(
  login: string,
  signal?: AbortSignal
): Promise<string | null> {
  const res = await fetch(`/api/twitch/socials?login=${encodeURIComponent(login)}`, {
    cache: "no-store",
    signal,
  });
  if (!res.ok) throw new Error(`socials lookup failed: ${res.status}`);
  const j = (await res.json()) as { socials?: { name: string; url: string }[] };
  const yt = j.socials?.find(
    (s) => /youtube\.com|youtu\.be/i.test(s.url) || /youtube/i.test(s.name)
  );
  return yt?.url ?? null;
}
