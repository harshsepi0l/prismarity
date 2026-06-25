"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import type { ChannelStats } from "@/lib/twitch/stats";
import type { KickStats } from "@/lib/kick/stats";
import type { Platform } from "./chat/types";
import { useChat } from "./useChat";
import { useSession } from "./useSession";

// One connected platform's live stats. `included` reflects the top-bar filter
// chips — toggling a platform off drops it from the combined roll-up.
export interface PlatformLive {
  platform: Platform;
  channelName: string;
  included: boolean; // toggled on via the top-bar chips (the lens)
  isLive: boolean;
  viewers: number;
  peakViewers: number;
  uptimeMs: number | null;
  // Stream context — each platform carries its OWN title/category so the header
  // never shows one platform's logo with another's description.
  title: string;
  category: string;
  followers: number | null;
  subs: number | null;
  chatters: number | null;
}

export interface LiveStats {
  loading: boolean;
  // Per connected platform (Twitch = active channel, Kick = linked counterpart).
  platforms: PlatformLive[];
  // Combined roll-up across included + live platforms.
  combinedViewers: number;
  combinedSubs: number | null;
  combinedFollowers: number | null;
  anyLive: boolean;
  // Chat-derived from the readable unified feed (Twitch today).
  messagesPerMin: number;
  uniqueChatters: number;
  activeChatters: number;
}

interface Derived {
  messagesPerMin: number;
  uniqueChatters: number;
  activeChatters: number;
  uptimeTwitchMs: number | null;
  uptimeKickMs: number | null;
}

const EMPTY_DERIVED: Derived = {
  messagesPerMin: 0,
  uniqueChatters: 0,
  activeChatters: 0,
  uptimeTwitchMs: null,
  uptimeKickMs: null,
};

const StatsContext = createContext<LiveStats | null>(null);

export function StatsProvider({ children }: { children: React.ReactNode }) {
  const { activeChannel, messages, activeKick } = useChat();
  const { connectedPlatforms, activeFilters } = useSession();

  const channelId = activeChannel?.id ?? null;
  const kickSlug = activeKick?.slug ?? null;

  const [twitchServer, setTwitchServer] = useState<ChannelStats | null>(null);
  const [kickServer, setKickServer] = useState<KickStats | null>(null);
  const [peakTwitch, setPeakTwitch] = useState(0);
  const [peakKick, setPeakKick] = useState(0);
  const [loading, setLoading] = useState(false);
  const [derived, setDerived] = useState<Derived>(EMPTY_DERIVED);

  // Twitch stats for the active channel (peak resets when the channel changes).
  useEffect(() => {
    let cancelled = false;
    /* eslint-disable react-hooks/set-state-in-effect */
    setPeakTwitch(0);
    if (!channelId) {
      setTwitchServer(null);
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
        setTwitchServer(json.stats);
        setPeakTwitch((p) => Math.max(p, json.stats!.viewers));
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

  // Kick stats for the active channel's linked Kick counterpart.
  useEffect(() => {
    let cancelled = false;
    /* eslint-disable react-hooks/set-state-in-effect */
    setPeakKick(0);
    if (!kickSlug) {
      setKickServer(null);
      return;
    }
    /* eslint-enable react-hooks/set-state-in-effect */
    async function load() {
      try {
        const res = await fetch(`/api/kick/stats?slug=${encodeURIComponent(kickSlug!)}`);
        if (!res.ok) return;
        const json = (await res.json()) as { stats?: KickStats | null };
        if (cancelled || !json.stats) return;
        setKickServer(json.stats);
        setPeakKick((p) => Math.max(p, json.stats!.viewers));
      } catch {
        /* ignore */
      }
    }
    load();
    const id = setInterval(load, 45_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [kickSlug]);

  // Latest inputs for the off-render-path computation.
  const messagesRef = useRef(messages);
  const twitchStartedRef = useRef<string | null>(null);
  const kickStartedRef = useRef<string | null>(null);
  useEffect(() => {
    messagesRef.current = messages;
    twitchStartedRef.current = twitchServer?.startedAt ?? null;
    kickStartedRef.current = kickServer?.startedAt ?? null;
  });

  // Recompute chat-derived stats + uptimes every few seconds (Date.now is impure
  // in render, so this runs in an interval).
  useEffect(() => {
    function compute() {
      const msgs = messagesRef.current;
      const now = Date.now();

      const seen = new Set<string>();
      const active = new Set<string>();
      let perMin = 0;

      for (const m of msgs) {
        if (m.platform === "self") continue;
        if (m.timestamp > now - 60_000) perMin++;
        if (m.timestamp > now - 300_000) active.add(m.user);
        seen.add(m.user);
      }

      const uptime = (s: string | null) =>
        s ? now - new Date(s).getTime() : null;

      setDerived({
        messagesPerMin: perMin,
        uniqueChatters: seen.size,
        activeChatters: active.size,
        uptimeTwitchMs: uptime(twitchStartedRef.current),
        uptimeKickMs: uptime(kickStartedRef.current),
      });
    }
    const id = setInterval(compute, 3000);
    return () => clearInterval(id);
  }, []);

  // Assemble per-platform rows for the connected platforms.
  const platforms: PlatformLive[] = [];
  if (connectedPlatforms.has("twitch") && activeChannel) {
    platforms.push({
      platform: "twitch",
      channelName: activeChannel.displayName,
      included: activeFilters.has("twitch"),
      isLive: twitchServer?.isLive ?? false,
      viewers: twitchServer?.viewers ?? 0,
      peakViewers: peakTwitch,
      uptimeMs: derived.uptimeTwitchMs,
      title: twitchServer?.title ?? "",
      category: twitchServer?.category ?? "",
      followers: twitchServer?.followers ?? null,
      subs: twitchServer?.subs ?? null,
      chatters: twitchServer?.chatters ?? null,
    });
  }
  if (activeKick) {
    platforms.push({
      platform: "kick",
      channelName: kickServer?.channelName || activeKick.slug,
      included: activeFilters.has("kick"),
      isLive: kickServer?.isLive ?? false,
      viewers: kickServer?.viewers ?? 0,
      peakViewers: peakKick,
      uptimeMs: derived.uptimeKickMs,
      title: kickServer?.title ?? "",
      category: kickServer?.category ?? "",
      followers: kickServer?.followers ?? null,
      subs: kickServer?.subs ?? null,
      chatters: null,
    });
  }

  // Combined roll-up over included platforms.
  const included = platforms.filter((p) => p.included);
  const combinedViewers = included
    .filter((p) => p.isLive)
    .reduce((sum, p) => sum + p.viewers, 0);
  const sumNullable = (pick: (p: PlatformLive) => number | null): number | null => {
    const vals = included.map(pick).filter((v): v is number => v != null);
    return vals.length ? vals.reduce((a, b) => a + b, 0) : null;
  };

  const stats: LiveStats = {
    loading,
    platforms,
    combinedViewers,
    combinedSubs: sumNullable((p) => p.subs),
    combinedFollowers: sumNullable((p) => p.followers),
    anyLive: included.some((p) => p.isLive),
    messagesPerMin: derived.messagesPerMin,
    uniqueChatters: derived.uniqueChatters,
    activeChatters: derived.activeChatters,
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
