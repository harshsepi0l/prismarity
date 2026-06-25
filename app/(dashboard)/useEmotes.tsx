"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { useChat } from "./useChat";

// code -> CDN image URL. Global third-party emotes plus the active channel's.
type EmoteMap = Record<string, string>;

const EmoteContext = createContext<EmoteMap>({});

export function EmoteProvider({ children }: { children: React.ReactNode }) {
  const { activeChannel } = useChat();
  const channelId = activeChannel?.id ?? null;
  const [emotes, setEmotes] = useState<EmoteMap>({});

  useEffect(() => {
    let cancelled = false;
    const url = channelId ? `/api/emotes?channelId=${channelId}` : "/api/emotes";
    fetch(url)
      .then((r) => (r.ok ? r.json() : { emotes: {} }))
      .then((json: { emotes?: EmoteMap }) => {
        if (!cancelled) setEmotes(json.emotes ?? {});
      })
      .catch(() => {
        /* ignore */
      });
    return () => {
      cancelled = true;
    };
  }, [channelId]);

  return <EmoteContext.Provider value={emotes}>{children}</EmoteContext.Provider>;
}

export function useEmotes(): EmoteMap {
  return useContext(EmoteContext);
}
