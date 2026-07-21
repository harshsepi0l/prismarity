"use client";

import { useEffect, useState } from "react";

export interface YouTubePresence {
  url: string | null;
  isLive: boolean;
}

// Resolves the YouTube presence of a set of Twitch logins (does the streamer
// have a YouTube linked, and — when `live` — are they live on it). Batches into
// one /api/youtube/for-channels request; the server caches the heavy live
// scrape. Returns a map keyed by lowercased login.
//
// `live` gates the expensive scrape: pass false for existence-only (search
// badges), true for live status (the sidebar edge bar).
export function useYouTubePresence(
  logins: string[],
  { live = false }: { live?: boolean } = {}
): Record<string, YouTubePresence> {
  const [map, setMap] = useState<Record<string, YouTubePresence>>({});

  // Stable key so we only refetch when the actual set of logins changes.
  const key = [...new Set(logins.map((l) => l.toLowerCase()))].sort().join(",");

  useEffect(() => {
    if (!key) {
      /* eslint-disable-next-line react-hooks/set-state-in-effect */
      setMap({});
      return;
    }
    let cancelled = false;
    const params = new URLSearchParams({ logins: key });
    if (live) params.set("live", "1");
    fetch(`/api/youtube/for-channels?${params.toString()}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { channels?: Record<string, YouTubePresence> } | null) => {
        if (!cancelled && j?.channels) setMap(j.channels);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [key, live]);

  return map;
}
