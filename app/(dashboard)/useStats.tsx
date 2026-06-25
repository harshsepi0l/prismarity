"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import type { ChannelStats } from "@/lib/twitch/stats";
import { useChat } from "./useChat";
import { useEmotes } from "./useEmotes";

export interface LiveStats {
  loading: boolean;
  // stream (public)
  isLive: boolean;
  viewers: number;
  peakViewers: number;
  uptimeMs: number | null;
  category: string;
  title: string;
  // privileged (null when not permitted / not connected)
  followers: number | null;
  subs: number | null;
  chatters: number | null;
  // chat-derived (computed locally from the live feed)
  messagesPerMin: number;
  uniqueChatters: number;
  activeChatters: number;
  topChatters: { user: string; count: number }[];
  topEmotes: { code: string; url: string; count: number }[];
}

interface Derived {
  messagesPerMin: number;
  uniqueChatters: number;
  activeChatters: number;
  topChatters: { user: string; count: number }[];
  topEmotes: { code: string; url: string; count: number }[];
  uptimeMs: number | null;
}

const EMPTY_DERIVED: Derived = {
  messagesPerMin: 0,
  uniqueChatters: 0,
  activeChatters: 0,
  topChatters: [],
  topEmotes: [],
  uptimeMs: null,
};

const StatsContext = createContext<LiveStats | null>(null);

export function StatsProvider({ children }: { children: React.ReactNode }) {
  const { activeChannel, messages } = useChat();
  const emotes = useEmotes();
  const channelId = activeChannel?.id ?? null;

  const [server, setServer] = useState<ChannelStats | null>(null);
  const [peakViewers, setPeakViewers] = useState(0);
  const [loading, setLoading] = useState(false);
  const [derived, setDerived] = useState<Derived>(EMPTY_DERIVED);

  // Fetch server stats for the active channel, refreshing periodically.
  useEffect(() => {
    let cancelled = false;
    /* eslint-disable react-hooks/set-state-in-effect */
    setPeakViewers(0);
    if (!channelId) {
      setServer(null);
      return;
    }
    setLoading(true);
    /* eslint-enable react-hooks/set-state-in-effect */
    async function load() {
      try {
        const res = await fetch(`/api/twitch/stats?channelId=${channelId}`);
        if (!res.ok) return;
        const json = (await res.json()) as { stats?: ChannelStats | null };
        if (cancelled || !json.stats) return;
        setServer(json.stats);
        setPeakViewers((p) => Math.max(p, json.stats!.viewers));
      } catch {
        /* ignore */
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    const id = setInterval(load, 45_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [channelId]);

  // Latest inputs for the off-render-path computation.
  const messagesRef = useRef(messages);
  const emotesRef = useRef(emotes);
  const startedAtRef = useRef<string | null>(null);
  useEffect(() => {
    messagesRef.current = messages;
    emotesRef.current = emotes;
    startedAtRef.current = server?.startedAt ?? null;
  });

  // Recompute chat-derived stats + uptime every few seconds (Date.now is impure
  // in render, so this runs in an interval).
  useEffect(() => {
    function compute() {
      const msgs = messagesRef.current;
      const emoteMap = emotesRef.current;
      const now = Date.now();

      const counts = new Map<string, number>();
      const emoteCounts = new Map<string, { count: number; url: string }>();
      const active = new Set<string>();
      let perMin = 0;

      for (const m of msgs) {
        if (m.platform === "self") continue;
        if (m.timestamp > now - 60_000) perMin++;
        if (m.timestamp > now - 300_000) active.add(m.user);
        counts.set(m.user, (counts.get(m.user) ?? 0) + 1);
        for (const tok of m.text.split(/\s+/)) {
          const url = m.nativeEmotes?.[tok] ?? emoteMap[tok];
          if (!url) continue;
          const e = emoteCounts.get(tok);
          if (e) e.count++;
          else emoteCounts.set(tok, { count: 1, url });
        }
      }

      const topChatters = [...counts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([user, count]) => ({ user, count }));
      const topEmotes = [...emoteCounts.entries()]
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, 5)
        .map(([code, v]) => ({ code, url: v.url, count: v.count }));
      const uptimeMs = startedAtRef.current
        ? now - new Date(startedAtRef.current).getTime()
        : null;

      setDerived({
        messagesPerMin: perMin,
        uniqueChatters: counts.size,
        activeChatters: active.size,
        topChatters,
        topEmotes,
        uptimeMs,
      });
    }
    const id = setInterval(compute, 3000);
    return () => clearInterval(id);
  }, []);

  const stats: LiveStats = {
    loading,
    isLive: server?.isLive ?? false,
    viewers: server?.viewers ?? 0,
    peakViewers,
    uptimeMs: derived.uptimeMs,
    category: server?.category ?? "",
    title: server?.title ?? "",
    followers: server?.followers ?? null,
    subs: server?.subs ?? null,
    chatters: server?.chatters ?? null,
    messagesPerMin: derived.messagesPerMin,
    uniqueChatters: derived.uniqueChatters,
    activeChatters: derived.activeChatters,
    topChatters: derived.topChatters,
    topEmotes: derived.topEmotes,
  };

  return <StatsContext.Provider value={stats}>{children}</StatsContext.Provider>;
}

export function useStats(): LiveStats {
  const ctx = useContext(StatsContext);
  if (!ctx) throw new Error("useStats must be used within a StatsProvider");
  return ctx;
}

// Formats a duration in ms as "3h 12m" / "12m" / "0m".
export function formatUptime(ms: number | null): string {
  if (ms == null || ms < 0) return "—";
  const totalMin = Math.floor(ms / 60_000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}
