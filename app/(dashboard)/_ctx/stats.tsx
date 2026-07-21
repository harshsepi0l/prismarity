"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import type { ChannelStats, TwitchClip } from "@/lib/twitch/stats";
import type { KickStats } from "@/lib/kick/stats";
import type { YouTubeStats } from "@/lib/youtube/stats";
import type { KickLeader } from "@/lib/kick/public";
import { kickLeaderboardUrl, parseKickLeaderboard } from "@/lib/kick/public";
import type { TwitchChatSettings } from "@/app/api/twitch/chat/route";
import type { Platform } from "../types";
import type { CheerLeader, GiftLeader } from "../chat/useTwitchChat";
import { useChat, useChatMessages } from "./chat";
import { useSession } from "./session";

// One connected platform's live stats. `included` reflects the top-bar filter
// chips — toggling a platform off drops it from the combined roll-up.
export interface PlatformLive {
  platform: Platform;
  channelName: string;
  profileImageUrl: string | null;
  included: boolean;
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
  // Twitch "verified" partner status (always false for platforms without the concept).
  verified: boolean;
  // Chat mode restrictions for this platform's current channel.
  chatMode: { followerOnly: boolean; followerMinutes: number; subOnly: boolean } | null;
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
  // Live, session-scoped Twitch tallies (any channel) — see useTwitchChat for
  // why these aren't Twitch's actual weekly numbers (that data isn't exposed
  // for channels that aren't yours).
  cheerLeaders: CheerLeader[];
  giftLeaders: GiftLeader[];
  // Top clips from the trailing week — public for any Twitch channel, real
  // Helix data (unlike the two above).
  clips: TwitchClip[];
  // Weekly Kick gift leaderboard — public for any channel.
  kickLeaders: KickLeader[];
  // Twitch "Stream Together" co-streamers — the OTHER participants sharing the
  // active channel's chat (empty when not co-streaming).
  collab: CollabPartner[];
}

export interface CollabPartner {
  login: string;
  displayName: string;
  profileImageUrl: string | null;
  verified: boolean;
  // LEADER of the Stream Together session (the co-stream host) vs a guest.
  host: boolean;
  // This partner's own live viewer count (null if unavailable).
  viewers: number | null;
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
  const { activeChannel, activeKick, cheerLeaders, giftLeaders } = useChat();
  const { messages } = useChatMessages();
  const { connectedPlatforms, activeFilters } = useSession();

  const channelId = activeChannel?.id ?? null;
  const kickSlug = activeKick?.slug ?? null;

  const [twitchServer, setTwitchServer] = useState<ChannelStats | null>(null);
  const [kickServer, setKickServer] = useState<KickStats | null>(null);
  const [youtubeServer, setYoutubeServer] = useState<YouTubeStats | null>(null);
  const [twitchAvatar, setTwitchAvatar] = useState<string | null>(null);
  const [twitchVerified, setTwitchVerified] = useState(false);
  const [kickVerified, setKickVerified] = useState(false);
  const [twitchChatSettings, setTwitchChatSettings] = useState<TwitchChatSettings | null>(null);
  const [peakTwitch, setPeakTwitch] = useState(0);
  const [peakKick, setPeakKick] = useState(0);
  const [loading, setLoading] = useState(false);
  const [derived, setDerived] = useState<Derived>(EMPTY_DERIVED);
  const [kickLeaders, setKickLeaders] = useState<KickLeader[]>([]);
  const [clips, setClips] = useState<TwitchClip[]>([]);
  const [collab, setCollab] = useState<CollabPartner[]>([]);

  // Twitch profile picture + chat settings — fetched once per active channel.
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    if (!channelId) {
      setTwitchAvatar(null);
      setTwitchVerified(false);
      setTwitchChatSettings(null);
      return;
    }
    /* eslint-enable react-hooks/set-state-in-effect */
    let cancelled = false;
    fetch(`/api/twitch/user?id=${channelId}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((j: { user?: { profileImageUrl?: string; broadcasterType?: string } | null }) => {
        if (!cancelled) {
          setTwitchAvatar(j.user?.profileImageUrl ?? null);
          setTwitchVerified(j.user?.broadcasterType === "partner");
        }
      })
      .catch(() => {});
    fetch(`/api/twitch/chat?channelId=${channelId}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { ok?: boolean; settings?: TwitchChatSettings } | null) => {
        if (!cancelled) setTwitchChatSettings(j?.settings ?? null);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [channelId]);

  // Weekly Kick gift leaderboard — public for any channel.
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    if (!kickSlug) {
      setKickLeaders([]);
      return;
    }
    /* eslint-enable react-hooks/set-state-in-effect */
    let cancelled = false;
    async function load() {
      // Browser-side fetch first — a real browser's TLS fingerprint passes
      // Cloudflare where the server IP is blocked (403). Fall back to the
      // server route if the direct call is blocked by CORS or fails.
      try {
        const v2 = await fetch(kickLeaderboardUrl(kickSlug!));
        if (v2.ok) {
          const leaders = parseKickLeaderboard(await v2.json());
          if (!cancelled) setKickLeaders(leaders);
          return;
        }
      } catch {
        /* CORS or network — fall through to the server route */
      }
      try {
        const res = await fetch(`/api/kick/leaderboard?slug=${encodeURIComponent(kickSlug!)}`);
        if (!res.ok) return;
        const json = (await res.json()) as { leaders?: KickLeader[] };
        if (!cancelled) setKickLeaders(json.leaders ?? []);
      } catch {
        /* ignore */
      }
    }
    load();
    const id = setInterval(load, 5 * 60_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [kickSlug]);

  // Weekly top clips — public for any Twitch channel, not just your own.
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    if (!channelId) {
      setClips([]);
      return;
    }
    /* eslint-enable react-hooks/set-state-in-effect */
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(`/api/twitch/clips?channelId=${channelId}`);
        if (!res.ok) return;
        const json = (await res.json()) as { clips?: TwitchClip[] };
        if (!cancelled) setClips(json.clips ?? []);
      } catch {
        /* ignore */
      }
    }
    load();
    const id = setInterval(load, 5 * 60_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [channelId]);

  // Twitch "Stream Together" co-streamers for the active channel.
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    if (!channelId) {
      setCollab([]);
      return;
    }
    /* eslint-enable react-hooks/set-state-in-effect */
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(`/api/twitch/shared-chat?channelId=${channelId}`);
        if (!res.ok) return;
        const json = (await res.json()) as {
          active?: boolean;
          participants?: { id: string; login: string; displayName: string; profileImageUrl: string | null; verified: boolean; host: boolean; viewers: number | null }[];
        };
        if (cancelled) return;
        const others = (json.active ? json.participants ?? [] : [])
          .filter((p) => p.id !== channelId)
          .map((p) => ({
            login: p.login,
            displayName: p.displayName,
            profileImageUrl: p.profileImageUrl,
            verified: p.verified,
            host: p.host,
            viewers: p.viewers,
          }));
        setCollab(others);
      } catch {
        /* ignore */
      }
    }
    load();
    // Co-streams start/end mid-broadcast, so poll a little faster than stats.
    const id = setInterval(load, 25_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [channelId]);

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

  // Kick "verified" flag — only exposed on Kick's Cloudflare-fronted v2 endpoint,
  // which blocks server IPs (403). A real browser's TLS passes, so we fetch it
  // directly here (same trick the gift leaderboard uses). Best-effort: if the
  // browser call is CORS-blocked or fails, the channel just shows unverified.
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    setKickVerified(false);
    if (!kickSlug) return;
    /* eslint-enable react-hooks/set-state-in-effect */
    let cancelled = false;
    fetch(`https://kick.com/api/v2/channels/${encodeURIComponent(kickSlug)}`, {
      headers: { Accept: "application/json" },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { verified?: unknown; user?: { verified?: unknown } } | null) => {
        if (cancelled || !j) return;
        setKickVerified(!!j.verified || !!j.user?.verified);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [kickSlug]);

  // YouTube stats for the connected account's OWN channel (live status +
  // subscriber count). Not tied to the tuned channel — there's no watch-any-
  // channel flow for YouTube — so it's driven purely by whether YouTube is
  // connected.
  useEffect(() => {
    let cancelled = false;
    /* eslint-disable react-hooks/set-state-in-effect */
    if (!connectedPlatforms.has("youtube")) {
      setYoutubeServer(null);
      return;
    }
    /* eslint-enable react-hooks/set-state-in-effect */
    async function load() {
      try {
        const res = await fetch("/api/youtube/stats", { cache: "no-store" });
        if (!res.ok) return;
        const json = (await res.json()) as { stats?: YouTubeStats | null };
        if (cancelled || !json.stats) return;
        setYoutubeServer(json.stats);
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
  }, [connectedPlatforms]);

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
      profileImageUrl: twitchAvatar,
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
      verified: twitchVerified,
      chatMode: twitchChatSettings
        ? {
            followerOnly: twitchChatSettings.followerOnly,
            followerMinutes: twitchChatSettings.followerMinutes,
            subOnly: twitchChatSettings.subOnly,
          }
        : null,
    });
  }
  if (activeKick) {
    const km = kickServer?.chatMode ?? null;
    platforms.push({
      platform: "kick",
      channelName: kickServer?.channelName || activeKick.slug,
      profileImageUrl: kickServer?.profileImageUrl ?? null,
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
      verified: kickVerified,
      chatMode: km
        ? { followerOnly: km.followerOnly, followerMinutes: km.followerMinutes, subOnly: km.subOnly }
        : null,
    });
  }

  // YouTube — the connected account's own channel. Standalone (not part of the
  // tuned Twitch/Kick selection): shows only "live or not" and the subscriber
  // count, which is surfaced as `followers` (YouTube subscribers are the free
  // follow relationship). No viewer/chat data yet.
  if (connectedPlatforms.has("youtube") && youtubeServer) {
    platforms.push({
      platform: "youtube",
      channelName: youtubeServer.channelName,
      profileImageUrl: youtubeServer.profileImageUrl,
      included: activeFilters.has("youtube"),
      isLive: youtubeServer.isLive,
      viewers: 0,
      peakViewers: 0,
      uptimeMs: null,
      title: "",
      category: "",
      followers: youtubeServer.subscribers,
      subs: null,
      chatters: null,
      verified: false,
      chatMode: null,
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
    cheerLeaders,
    giftLeaders,
    clips,
    kickLeaders,
    collab,
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
