"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { useChat } from "./useChat";
import type { EmoteSource } from "@/app/api/emotes/route";

// code -> CDN image URL. Global third-party emotes plus the active channel's.
type EmoteMap = Record<string, string>;

export interface EmoteCategory {
  source: EmoteSource;
  emotes: { code: string; url: string }[];
}

interface EmoteStore {
  map: EmoteMap;
  categories: EmoteCategory[];
}

const EmoteContext = createContext<EmoteStore>({ map: {}, categories: [] });

export function EmoteProvider({ children }: { children: React.ReactNode }) {
  const { activeChannel } = useChat();
  const channelId = activeChannel?.id ?? null;
  const [store, setStore] = useState<EmoteStore>({ map: {}, categories: [] });

  useEffect(() => {
    let cancelled = false;
    const url = channelId ? `/api/emotes?channelId=${channelId}` : "/api/emotes";
    fetch(url)
      .then((r) => (r.ok ? r.json() : { emotes: {}, categories: [] }))
      .then((json: { emotes?: EmoteMap; categories?: EmoteCategory[] }) => {
        if (!cancelled) setStore({ map: json.emotes ?? {}, categories: json.categories ?? [] });
      })
      .catch(() => {
        /* ignore */
      });
    return () => {
      cancelled = true;
    };
  }, [channelId]);

  return <EmoteContext.Provider value={store}>{children}</EmoteContext.Provider>;
}

export function useEmotes(): EmoteMap {
  return useContext(EmoteContext).map;
}

export function useEmoteCategories(): EmoteCategory[] {
  return useContext(EmoteContext).categories;
}
