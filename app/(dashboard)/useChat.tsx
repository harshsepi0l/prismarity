"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ChatMessage, ConnectionStatus, Platform } from "./chat/types";
import type { FollowedChannel } from "@/lib/twitch/channels";
import type { Role } from "@/lib/auth/types";
import { useTwitchChat } from "./chat/useTwitchChat";
import { useKickChat } from "./chat/useKickChat";

// Chat session state lives in the dashboard layout, ABOVE the routes, so the
// live sockets, channel list, and active selection survive navigating to
// Loyalty/VODs and back.
//
// The panel keeps Twitch and Kick independent. Twitch is the auto-pulled follow
// list (Kick has no follows API). Kick channels arrive two ways: AUTO-DETECTED
// when a Twitch follow's handle also exists on Kick (exact match → merged row),
// or MANUALLY ADDED for Kick-only channels. Existence is probed once per handle
// and cached locally. Per-channel link overrides handle the cases where the
// handles differ across platforms.

const LINKS_KEY = "prismarity:kick-links";
const MANUAL_KEY = "prismarity:kick-manual";
const CACHE_KEY = "prismarity:kick-cache";

// twitchChannelId -> kick slug (override), or null = explicitly unlinked.
type LinkMap = Record<string, string | null>;
// kick slug -> resolved existence + ids (persisted so we don't re-probe).
interface KickResolved {
  exists: boolean;
  chatroomId: number | null;
  broadcasterUserId: number | null;
}
type CacheMap = Record<string, KickResolved>;

export interface ActiveKick {
  slug: string;
  chatroomId: number;
}

export interface KickOnlyChannel {
  slug: string;
  isLive: boolean;
  viewers: number;
}

interface ChatStore {
  status: ConnectionStatus;
  messages: ChatMessage[];
  ownChannel: FollowedChannel | null;
  followedChannels: FollowedChannel[];
  activeChannel: FollowedChannel | null;
  activeKickOnly: string | null; // slug, when a Kick-only channel is selected
  // The role for the current selection, across platforms (your own Twitch OR
  // Kick channel = creator; a moderated Twitch channel = moderator; else viewer).
  activeRole: Role;
  selectChannel: (channel: FollowedChannel) => void;
  selectKickOnly: (slug: string) => void;
  // Record a message you just sent as a single unified entry (with the platforms
  // it went to). Echoes of it from the read sockets are suppressed.
  addSelfMessage: (text: string, platforms: Platform[]) => void;
  // Cross-platform (Kick) state.
  kickConnected: boolean;
  // Your own Kick channel (independent of Twitch). Null until Kick is connected.
  ownKick: KickOnlyChannel | null;
  activeKick: ActiveKick | null;
  // The matched/linked Kick slug for a Twitch channel (drives the merged row),
  // or null when there's no Kick counterpart.
  kickSlugFor: (channel: FollowedChannel) => string | null;
  // Per-channel link override.
  getLink: (twitchId: string) => string | null | undefined;
  setLink: (twitchId: string, slug: string | null) => void;
  clearLink: (twitchId: string) => void;
  // Manually-added Kick-only channels.
  manualKick: KickOnlyChannel[];
  addManualKick: (slug: string) => void;
  removeManualKick: (slug: string) => void;
}

const ChatContext = createContext<ChatStore | null>(null);

export function ChatProvider({
  kickSlug = null,
  children,
}: {
  kickSlug?: string | null; // the logged-in user's own Kick slug (if connected)
  children: React.ReactNode;
}) {
  const { messages: twitchMessages, status, connect: connectTwitch } = useTwitchChat();
  const { messages: kickMessages, connect: connectKick } = useKickChat();

  const kickConnected = !!kickSlug;

  const [ownChannel, setOwnChannel] = useState<FollowedChannel | null>(null);
  const [followedChannels, setFollowedChannels] = useState<FollowedChannel[]>([]);
  const [activeChannel, setActiveChannel] = useState<FollowedChannel | null>(null);
  const [activeKickOnly, setActiveKickOnly] = useState<string | null>(null);

  const [links, setLinks] = useState<LinkMap>({});
  const [manual, setManual] = useState<string[]>([]);
  const [cache, setCache] = useState<CacheMap>({});
  const [manualStats, setManualStats] = useState<Record<string, { isLive: boolean; viewers: number }>>({});
  const [activeKick, setActiveKick] = useState<ActiveKick | null>(null);
  // Messages you've sent this selection, each a single entry across platforms.
  const [selfMessages, setSelfMessages] = useState<ChatMessage[]>([]);

  // Load persisted links / manual list / existence cache.
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    try {
      const raw = localStorage.getItem(LINKS_KEY);
      if (raw) setLinks(JSON.parse(raw) as LinkMap);
    } catch {
      /* ignore */
    }
    try {
      const raw = localStorage.getItem(MANUAL_KEY);
      if (raw) setManual(JSON.parse(raw) as string[]);
    } catch {
      /* ignore */
    }
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (raw) setCache(JSON.parse(raw) as CacheMap);
    } catch {
      /* ignore */
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  // Load own + followed Twitch channels, refreshing to keep live status current.
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/twitch/followed");
        if (!res.ok) return;
        const json = (await res.json()) as {
          own?: FollowedChannel | null;
          followed?: FollowedChannel[];
        };
        if (cancelled) return;
        const own = json.own ?? null;
        const followed = json.followed ?? [];
        setOwnChannel(own);
        setFollowedChannels(followed);
        setActiveChannel((prev) => {
          if (!prev) return prev;
          const all = own ? [own, ...followed] : followed;
          return all.find((c) => c.id === prev.id) ?? prev;
        });
      } catch {
        /* ignore */
      }
    }
    load();
    const id = setInterval(load, 60_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  // ── persistence helpers ──────────────────────────────────
  const persist = useCallback((key: string, value: unknown) => {
    localStorage.setItem(key, JSON.stringify(value));
  }, []);

  const setLink = useCallback(
    (twitchId: string, slug: string | null) => {
      setLinks((prev) => {
        const next = { ...prev, [twitchId]: slug };
        persist(LINKS_KEY, next);
        return next;
      });
    },
    [persist]
  );
  const clearLink = useCallback(
    (twitchId: string) => {
      setLinks((prev) => {
        const next = { ...prev };
        delete next[twitchId];
        persist(LINKS_KEY, next);
        return next;
      });
    },
    [persist]
  );
  const getLink = useCallback((twitchId: string) => links[twitchId], [links]);

  const addManualKick = useCallback(
    (slug: string) => {
      const v = slug.trim().toLowerCase().replace(/^@/, "");
      if (!v) return;
      setManual((prev) => {
        if (prev.includes(v)) return prev;
        const next = [...prev, v];
        persist(MANUAL_KEY, next);
        return next;
      });
    },
    [persist]
  );
  const removeManualKick = useCallback(
    (slug: string) => {
      setManual((prev) => {
        const next = prev.filter((s) => s !== slug);
        persist(MANUAL_KEY, next);
        return next;
      });
    },
    [persist]
  );

  // ── Kick existence probe (cached) ────────────────────────
  // Candidate slugs to verify: each Twitch follow's handle, the own Kick slug,
  // manual adds, and any explicit link target.
  const candidates = useMemo(() => {
    if (!kickConnected) return [] as string[];
    const set = new Set<string>();
    const add = (s?: string | null) => {
      if (s) set.add(s.toLowerCase().replace(/^@/, ""));
    };
    if (ownChannel) add(ownChannel.login);
    for (const c of followedChannels) add(c.login);
    for (const s of manual) add(s);
    for (const v of Object.values(links)) add(v);
    if (kickSlug) add(kickSlug);
    return [...set];
  }, [kickConnected, ownChannel, followedChannels, manual, links, kickSlug]);

  const probingRef = useRef(false);
  useEffect(() => {
    if (!kickConnected) return;
    const todo = candidates.filter((s) => !(s in cache));
    if (todo.length === 0 || probingRef.current) return;

    let cancelled = false;
    probingRef.current = true;
    (async () => {
      try {
        // Probe in chunks; merge + persist as we go so badges fill in.
        for (let i = 0; i < todo.length && !cancelled; i += 15) {
          const chunk = todo.slice(i, i + 15);
          const res = await fetch(`/api/kick/resolve-batch?slugs=${chunk.map(encodeURIComponent).join(",")}`);
          if (!res.ok) break;
          const json = (await res.json()) as { results?: CacheMap };
          if (cancelled || !json.results) break;
          setCache((prev) => {
            const next = { ...prev, ...json.results };
            persist(CACHE_KEY, next);
            return next;
          });
        }
      } finally {
        probingRef.current = false;
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [candidates, cache, kickConnected, persist]);

  // ── Kick match resolution ────────────────────────────────
  const isOwn = useCallback(
    (channel: FollowedChannel) => channel.role === "creator",
    []
  );

  // The Kick slug a Twitch channel maps to (override → auto by exact handle),
  // or null when there's no counterpart.
  const kickSlugFor = useCallback(
    (channel: FollowedChannel): string | null => {
      if (!kickConnected) return null;
      const link = links[channel.id];
      if (link === null) return null; // explicitly unlinked
      if (typeof link === "string" && link) return link;
      // Auto: own channel maps to your own Kick slug; others match by handle.
      if (isOwn(channel) && kickSlug) return kickSlug;
      const handle = channel.login.toLowerCase();
      return cache[handle]?.exists ? handle : null;
    },
    [kickConnected, links, isOwn, kickSlug, cache]
  );

  // ── selection ────────────────────────────────────────────
  const selectChannel = useCallback((channel: FollowedChannel) => {
    setActiveKickOnly(null);
    setActiveChannel(channel);
  }, []);
  const selectKickOnly = useCallback((slug: string) => {
    setActiveChannel(null);
    setActiveKickOnly(slug.toLowerCase());
  }, []);

  // Add a unified self message for a send. One entry carries every platform it
  // was delivered to, so a Twitch+Kick send shows as a single message.
  const addSelfMessage = useCallback(
    (text: string, platforms: Platform[]) => {
      if (platforms.length === 0) return;
      const msg: ChatMessage = {
        id: `self-${Date.now()}-${Math.random()}`,
        platform: "self",
        platforms,
        user: ownChannel?.displayName ?? kickSlug ?? "You",
        text,
        color: null,
        timestamp: Date.now(),
      };
      setSelfMessages((prev) => [...prev.slice(-50), msg]);
    },
    [ownChannel, kickSlug]
  );

  // Clear self messages when the selection changes (they belong to one channel).
  const selectionKey = activeChannel?.id ?? activeKickOnly ?? null;
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelfMessages([]);
  }, [selectionKey]);

  // Resolve the active selection's Kick side into a live target (slug + chatroom).
  const desiredKickSlug = activeChannel
    ? kickSlugFor(activeChannel)
    : activeKickOnly;
  useEffect(() => {
    let cancelled = false;
    if (!desiredKickSlug) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setActiveKick(null);
      return;
    }
    const cached = cache[desiredKickSlug];
    if (cached?.exists && cached.chatroomId) {
      setActiveKick({ slug: desiredKickSlug, chatroomId: cached.chatroomId });
      return;
    }
    // Not cached yet → resolve on demand.
    (async () => {
      try {
        const res = await fetch(`/api/kick/resolve?slug=${encodeURIComponent(desiredKickSlug)}`);
        const json = (await res.json()) as { exists?: boolean; slug?: string; chatroomId?: number | null };
        if (cancelled) return;
        if (json.exists && json.chatroomId) {
          setActiveKick({ slug: json.slug ?? desiredKickSlug, chatroomId: json.chatroomId });
          setCache((prev) => {
            const next = {
              ...prev,
              [desiredKickSlug]: { exists: true, chatroomId: json.chatroomId!, broadcasterUserId: prev[desiredKickSlug]?.broadcasterUserId ?? null },
            };
            persist(CACHE_KEY, next);
            return next;
          });
        } else {
          setActiveKick(null);
        }
      } catch {
        if (!cancelled) setActiveKick(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [desiredKickSlug, cache, persist]);

  // ── manual Kick-only channels (with light live status) ───
  const matchedHandles = useMemo(() => {
    const set = new Set<string>();
    if (ownChannel) set.add(ownChannel.login.toLowerCase());
    for (const c of followedChannels) set.add(c.login.toLowerCase());
    return set;
  }, [ownChannel, followedChannels]);

  // Kick-only = manual adds that don't collide with a Twitch follow handle.
  const kickOnlySlugs = useMemo(
    () => manual.filter((s) => !matchedHandles.has(s)),
    [manual, matchedHandles]
  );

  // Slugs we track live status for: your own Kick channel + Kick-only follows.
  const liveSlugs = useMemo(() => {
    const set = new Set(kickOnlySlugs);
    if (kickSlug) set.add(kickSlug.toLowerCase());
    return [...set];
  }, [kickOnlySlugs, kickSlug]);

  // Refresh live status for the (few) tracked Kick channels.
  useEffect(() => {
    if (liveSlugs.length === 0) return;
    let cancelled = false;
    async function load() {
      const entries = await Promise.all(
        liveSlugs.map(async (slug) => {
          try {
            const res = await fetch(`/api/kick/stats?slug=${encodeURIComponent(slug)}`);
            const json = (await res.json()) as { stats?: { isLive: boolean; viewers: number } | null };
            return [slug, json.stats ? { isLive: json.stats.isLive, viewers: json.stats.viewers } : { isLive: false, viewers: 0 }] as const;
          } catch {
            return [slug, { isLive: false, viewers: 0 }] as const;
          }
        })
      );
      if (!cancelled) setManualStats(Object.fromEntries(entries));
    }
    load();
    const id = setInterval(load, 60_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [liveSlugs]);

  const manualKick = useMemo<KickOnlyChannel[]>(
    () =>
      kickOnlySlugs.map((slug) => ({
        slug,
        isLive: manualStats[slug]?.isLive ?? false,
        viewers: manualStats[slug]?.viewers ?? 0,
      })),
    [kickOnlySlugs, manualStats]
  );

  // Your own Kick channel as a selectable entity (creator role), independent of
  // whether Twitch is connected.
  const ownKick = useMemo<KickOnlyChannel | null>(() => {
    if (!kickSlug) return null;
    const s = kickSlug.toLowerCase();
    return {
      slug: s,
      isLive: manualStats[s]?.isLive ?? false,
      viewers: manualStats[s]?.viewers ?? 0,
    };
  }, [kickSlug, manualStats]);

  // Role for the active selection — your own Twitch/Kick channel is "creator".
  const activeRole: Role = activeChannel
    ? activeChannel.role
    : activeKickOnly && kickSlug && activeKickOnly.toLowerCase() === kickSlug.toLowerCase()
      ? "creator"
      : "viewer";

  // ── live sockets ─────────────────────────────────────────
  const targetLogin = activeChannel?.login ?? null;
  useEffect(() => {
    if (targetLogin) connectTwitch(targetLogin);
  }, [targetLogin, connectTwitch]);

  const kickRoom = activeKick?.chatroomId ?? null;
  useEffect(() => {
    connectKick(kickRoom);
  }, [kickRoom, connectKick]);

  // Merge both feeds chronologically (bounded). Socket echoes of a message we
  // just sent are dropped in favour of its single unified self entry — matched
  // by platform + text within a short window of the send.
  const messages = useMemo(() => {
    if (!activeChannel && !activeKickOnly) return [];
    const socket = [...twitchMessages, ...kickMessages].filter(
      (m) =>
        !selfMessages.some(
          (sm) =>
            sm.platforms?.includes(m.platform as Platform) &&
            sm.text.trim() === m.text.trim() &&
            Math.abs(m.timestamp - sm.timestamp) < 15_000
        )
    );
    return [...socket, ...selfMessages]
      .sort((a, b) => a.timestamp - b.timestamp)
      .slice(-300);
  }, [activeChannel, activeKickOnly, twitchMessages, kickMessages, selfMessages]);

  return (
    <ChatContext.Provider
      value={{
        status,
        messages,
        ownChannel,
        followedChannels,
        activeChannel,
        activeKickOnly,
        activeRole,
        selectChannel,
        selectKickOnly,
        addSelfMessage,
        kickConnected,
        ownKick,
        activeKick,
        kickSlugFor,
        getLink,
        setLink,
        clearLink,
        manualKick,
        addManualKick,
        removeManualKick,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}

export function useChat(): ChatStore {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error("useChat must be used within a ChatProvider");
  return ctx;
}
