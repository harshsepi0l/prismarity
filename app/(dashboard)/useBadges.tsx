"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { useChat } from "./useChat";
import type { BadgeInfo } from "@/lib/twitch/badges";
import type { KickSubBadgeTier } from "@/lib/kick/public";
import type { KickGlobalBadge } from "@/lib/kick/global-badges";

interface BadgeStore {
  twitchBadges: Record<string, BadgeInfo>;    // "setId:id" -> info
  kickSubBadges: KickSubBadgeTier[];          // sorted ascending by months
  kickGlobalBadges: Record<string, KickGlobalBadge>; // "type:level" -> badge
}

const EMPTY: BadgeStore = { twitchBadges: {}, kickSubBadges: [], kickGlobalBadges: {} };
const BadgeContext = createContext<BadgeStore>(EMPTY);

export function BadgeProvider({ children }: { children: React.ReactNode }) {
  const { activeChannel, activeKick } = useChat();
  const channelId = activeChannel?.id ?? null;
  const kickSlug = activeKick?.slug ?? null;

  const [twitchBadges, setTwitchBadges] = useState<Record<string, BadgeInfo>>({});
  const [kickSubBadges, setKickSubBadges] = useState<KickSubBadgeTier[]>([]);
  const [kickGlobalBadges, setKickGlobalBadges] = useState<Record<string, KickGlobalBadge>>({});

  // Global Kick badges (level badges etc.) — fetched once, not per-channel.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/kick/badges/global")
      .then((r) => (r.ok ? r.json() : { badges: {} }))
      .then((json: { badges?: Record<string, KickGlobalBadge> }) => {
        if (!cancelled) setKickGlobalBadges(json.badges ?? {});
      })
      .catch(() => { /* ignore — text fallback handles it */ });
    return () => { cancelled = true; };
  }, []);

  // Real badge art (sub tiers, bits tiers, custom channel badges) for the
  // active Twitch channel — public data, any valid token.
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    if (!channelId) {
      setTwitchBadges({});
      return;
    }
    /* eslint-enable react-hooks/set-state-in-effect */
    let cancelled = false;
    fetch(`/api/twitch/badges?channelId=${channelId}`)
      .then((r) => (r.ok ? r.json() : { badges: {} }))
      .then((json: { badges?: Record<string, BadgeInfo> }) => {
        if (!cancelled) setTwitchBadges(json.badges ?? {});
      })
      .catch(() => {
        /* ignore */
      });
    return () => {
      cancelled = true;
    };
  }, [channelId]);

  // Subscriber badge tiers for the active Kick channel.
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    if (!kickSlug) {
      setKickSubBadges([]);
      return;
    }
    /* eslint-enable react-hooks/set-state-in-effect */
    let cancelled = false;
    fetch(`/api/kick/badges?slug=${encodeURIComponent(kickSlug)}`)
      .then((r) => (r.ok ? r.json() : { subBadges: [] }))
      .then((json: { subBadges?: KickSubBadgeTier[] }) => {
        if (!cancelled) setKickSubBadges(json.subBadges ?? []);
      })
      .catch(() => {
        /* ignore */
      });
    return () => {
      cancelled = true;
    };
  }, [kickSlug]);

  return (
    <BadgeContext.Provider value={{ twitchBadges, kickSubBadges, kickGlobalBadges }}>
      {children}
    </BadgeContext.Provider>
  );
}

export function useBadges(): BadgeStore {
  return useContext(BadgeContext);
}

// Resolves a normalized badge ref to real art.
// - Twitch: always has art via Helix badge sets
// - Kick subscriber: tier-matched from channel's subscriber_badges
// - Kick level + other global: looked up in kickGlobalBadges by "type:id"
export function resolveBadgeImage(
  store: BadgeStore,
  platform: "twitch" | "kick" | "youtube" | "self",
  badge: { setId: string; id: string }
): string | null {
  if (platform === "twitch") {
    return store.twitchBadges[`${badge.setId}:${badge.id}`]?.imageUrl ?? null;
  }
  if (platform === "kick") {
    if (badge.setId === "subscriber") {
      const months = Number(badge.id) || 0;
      let best: string | null = null;
      for (const tier of store.kickSubBadges) {
        if (tier.months <= months) best = tier.imageUrl;
      }
      return best;
    }
    // Level badges and any other global Kick badges.
    return store.kickGlobalBadges[`${badge.setId}:${badge.id}`]?.imageUrl ?? null;
  }
  return null;
}
