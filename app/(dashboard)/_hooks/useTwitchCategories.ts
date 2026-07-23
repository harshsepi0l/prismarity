"use client";

import { useEffect, useState } from "react";

export interface TwitchCategory {
  game: string;
}

// What each live Twitch channel is playing right now, keyed by lowercased login.
// Batches the whole set of visible sidebar logins into one /api/twitch/categories
// request (a single Get Streams call server-side) and refreshes on an interval so
// the "now playing" ticker follows category changes. Offline channels are absent.
export function useTwitchCategories(logins: string[]): Record<string, TwitchCategory> {
  const [map, setMap] = useState<Record<string, TwitchCategory>>({});

  // Stable key so we only refetch when the actual set of logins changes.
  const key = [...new Set(logins.map((l) => l.toLowerCase()))].sort().join(",");

  useEffect(() => {
    if (!key) {
      /* eslint-disable-next-line react-hooks/set-state-in-effect */
      setMap({});
      return;
    }
    let cancelled = false;
    const load = () => {
      fetch(`/api/twitch/categories?logins=${encodeURIComponent(key)}`, { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((j: { categories?: Record<string, TwitchCategory> } | null) => {
          if (!cancelled && j?.categories) setMap(j.categories);
        })
        .catch(() => {});
    };
    load();
    const id = setInterval(load, 90_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [key]);

  return map;
}
