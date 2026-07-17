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
import type { ChatMessage, ConnectionStatus, Platform, SearchResult } from "../types";
import type { FollowedChannel } from "@/lib/twitch/channels";
import type { Role } from "@/lib/auth/types";
import { useTwitchChat, type CheerLeader, type GiftLeader } from "../chat/useTwitchChat";
import { useKickChat } from "../chat/useKickChat";
import { nextSeq } from "../chat/seq";

// Chat session state lives in the dashboard layout, ABOVE the routes, so the
// live sockets and active selection survive navigating to Loyalty/VODs and back.
//
// There is no follow list: you reach any streamer through SEARCH, which matches
// the same handle across Twitch + Kick. The only pinned entry is YOUR CHANNEL
// (your own Twitch / Kick), since that's your creator workspace.

export interface ActiveKick {
  slug: string;
  chatroomId: number;
}

export interface KickOnlyChannel {
  slug: string;
  isLive: boolean;
  viewers: number;
  profileImageUrl: string | null;
}

// A recent chatter — surfaced by the composer's @-mention autocomplete and the
// chat header's participants roster.
export interface MentionCandidate {
  user: string;
  platform: "twitch" | "kick";
  color: string | null;
  // Platform user id, when known — lets the participants roster open the UserCard.
  userId?: string;
}

interface PendingKick {
  slug: string;
  chatroomId: number | null;
}

// High-frequency chat feed lives in its own context so components that only
// need channels/selection (NavRail, Settings, TopBar…) don't re-render on every
// incoming message — only the feed (chat page, stats) subscribes here.
interface ChatMessages {
  status: ConnectionStatus;
  messages: ChatMessage[];
}

interface ChatStore {
  ownChannel: FollowedChannel | null;
  ownKick: KickOnlyChannel | null;
  activeChannel: FollowedChannel | null;
  activeKickOnly: string | null; // slug, when a Kick-only selection is active
  activeRole: Role;
  activeKick: ActiveKick | null;
  kickConnected: boolean;
  // Channels added from search — persisted to localStorage.
  watchedChannels: SearchResult[];
  // Channels you follow on Twitch (Kick-cross-linked) — fetched from the API.
  followedChannels: SearchResult[];
  // Live, session-scoped tallies for the active Twitch channel (see
  // useTwitchChat for why these aren't Twitch's actual weekly numbers).
  cheerLeaders: CheerLeader[];
  giftLeaders: GiftLeader[];
  selectChannel: (channel: FollowedChannel) => void;
  selectKickOnly: (slug: string) => void;
  selectSearchResult: (result: SearchResult) => void;
  clearSelection: () => void;
  addWatchedChannel: (result: SearchResult) => void;
  removeWatchedChannel: (handle: string) => void;
  addSelfMessage: (text: string, platforms: Platform[]) => void;
  // Recent chatters matching `query` on the given platforms, most-recent first.
  // Reads a ref, so calling it does NOT subscribe the caller to the message feed.
  getMentionCandidates: (query: string, platforms: Platform[], limit?: number) => MentionCandidate[];
  // The full roster of chatters seen this session on the given platforms, most
  // recently active first. Same ref-backed, non-subscribing read as above.
  getAllParticipants: (platforms: Platform[]) => MentionCandidate[];
  beaconMode: boolean;
  setBeaconMode: (on: boolean) => void;
}

const ChatContext = createContext<ChatStore | null>(null);
const ChatMessagesContext = createContext<ChatMessages | null>(null);

export function ChatProvider({
  kickSlug = null,
  twitchConnected = false,
  children,
}: {
  kickSlug?: string | null; // the logged-in user's own Kick slug (if connected)
  twitchConnected?: boolean; // whether a Twitch account is connected this session
  children: React.ReactNode;
}) {
  const {
    messages: twitchMessages,
    status,
    connect: connectTwitch,
    cheerLeaders,
    giftLeaders,
  } = useTwitchChat();
  const { messages: kickMessages, connect: connectKick } = useKickChat();

  const kickConnected = !!kickSlug;

  const [watchedChannels, setWatchedChannels] = useState<SearchResult[]>([]);
  const [followedChannels, setFollowedChannels] = useState<SearchResult[]>([]);

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem("prismarity:watched-channels") ?? "[]") as SearchResult[];
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setWatchedChannels(stored);
    } catch { /* ignore */ }
  }, []);

  const addWatchedChannel = useCallback((result: SearchResult) => {
    setWatchedChannels((prev) => {
      const next = [...prev.filter((c) => c.handle !== result.handle), result];
      localStorage.setItem("prismarity:watched-channels", JSON.stringify(next));
      return next;
    });
  }, []);

  const removeWatchedChannel = useCallback((handle: string) => {
    setWatchedChannels((prev) => {
      const next = prev.filter((c) => c.handle !== handle);
      localStorage.setItem("prismarity:watched-channels", JSON.stringify(next));
      return next;
    });
  }, []);

  // Watched channels' live status is frozen at add-time in localStorage; re-poll
  // it (on load + every 60s) so channels that went offline stop showing as live.
  const watchedHandles = watchedChannels.map((c) => c.handle).join(",");
  useEffect(() => {
    if (!watchedHandles) return;
    let cancelled = false;
    async function refresh() {
      const handles = watchedHandles.split(",").filter(Boolean);
      const fresh = await Promise.all(
        handles.map(async (h) => {
          try {
            const res = await fetch(`/api/search?q=${encodeURIComponent(h)}`);
            if (!res.ok) return null;
            const { results } = (await res.json()) as { results: SearchResult[] };
            return results.find((r) => r.handle === h) ?? null;
          } catch {
            return null;
          }
        })
      );
      if (cancelled) return;
      const byHandle = new Map(
        fresh.filter((r): r is SearchResult => !!r).map((r) => [r.handle, r])
      );
      setWatchedChannels((prev) => {
        let changed = false;
        const next = prev.map((c) => {
          const f = byHandle.get(c.handle);
          if (!f) return c;
          changed = true;
          return { ...c, twitch: f.twitch, kick: f.kick, profileImageUrl: f.profileImageUrl ?? c.profileImageUrl };
        });
        return changed ? next : prev;
      });
    }
    refresh();
    const id = setInterval(refresh, 60_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [watchedHandles]);

  const [ownChannel, setOwnChannel] = useState<FollowedChannel | null>(null);
  const [ownKickStat, setOwnKickStat] = useState<{ isLive: boolean; viewers: number; profileImageUrl: string | null } | null>(null);
  const [activeChannel, setActiveChannel] = useState<FollowedChannel | null>(null);
  const [activeKickOnly, setActiveKickOnly] = useState<string | null>(null);
  const [pendingKick, setPendingKick] = useState<PendingKick | null>(null);
  const [activeKick, setActiveKick] = useState<ActiveKick | null>(null);
  const [selfMessages, setSelfMessages] = useState<ChatMessage[]>([]);
  const [beaconMode, setBeaconModeState] = useState(false);
  const lastBeaconRef = useRef<string | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setBeaconModeState(localStorage.getItem("prismarity:beacon-mode") === "1");
  }, []);

  const setBeaconMode = useCallback((on: boolean) => {
    setBeaconModeState(on);
    localStorage.setItem("prismarity:beacon-mode", on ? "1" : "0");
    if (!on) lastBeaconRef.current = null;
  }, []);

  // Select a unified search result — wires up whichever platforms it spans.
  // Declared above the beacon effect (below), which references it.
  const selectSearchResult = useCallback((result: SearchResult) => {
    if (result.twitch) {
      const t = result.twitch;
      setActiveKickOnly(null);
      setActiveChannel({
        id: t.id,
        login: t.login,
        displayName: t.displayName,
        profileImageUrl: t.profileImageUrl,
        isLive: t.isLive,
        viewerCount: 0,
        role: t.role,
      });
      setPendingKick(result.kick ? { slug: result.kick.slug, chatroomId: result.kick.chatroomId } : null);
    } else if (result.kick) {
      setActiveChannel(null);
      setActiveKickOnly(result.kick.slug.toLowerCase());
      setPendingKick({ slug: result.kick.slug, chatroomId: result.kick.chatroomId });
    }
  }, []);

  // Beacon: poll /api/beacon every 3s and auto-select the detected stream.
  useEffect(() => {
    if (!beaconMode) return;
    async function poll() {
      try {
        const res = await fetch("/api/beacon");
        if (!res.ok) return;
        const data = (await res.json()) as { platform?: string; channel?: string };
        if (!data.channel || !data.platform) return;
        const key = `${data.platform}:${data.channel}`;
        if (key === lastBeaconRef.current) return;
        lastBeaconRef.current = key;
        const sr = await fetch(`/api/search?q=${encodeURIComponent(data.channel)}`);
        if (!sr.ok) return;
        const { results } = (await sr.json()) as { results: SearchResult[] };
        const match =
          results.find(
            (r) =>
              (data.platform === "twitch" && r.twitch?.login.toLowerCase() === data.channel) ||
              (data.platform === "kick" && r.kick?.slug.toLowerCase() === data.channel)
          ) ?? results[0] ?? null;
        if (match) selectSearchResult(match);
      } catch { /* network errors are silent in beacon mode */ }
    }
    poll();
    const id = setInterval(poll, 3000);
    return () => clearInterval(id);
  // selectSearchResult is stable (useCallback [])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [beaconMode]);

  // Pin your own Twitch channel (creator), refreshing live status periodically.
  // Keyed on twitchConnected so it re-fetches the moment the connection appears
  // after login (router.refresh updates the prop) — no manual reload needed.
  useEffect(() => {
    if (!twitchConnected) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setOwnChannel(null);
      return;
    }
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/twitch/me");
        if (!res.ok) return;
        const json = (await res.json()) as { own?: FollowedChannel | null };
        if (cancelled) return;
        setOwnChannel(json.own ?? null);
        // Keep an active own-channel selection's live status in sync.
        setActiveChannel((prev) =>
          prev && json.own && prev.id === json.own.id ? json.own : prev
        );
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
  }, [twitchConnected]);

  // Followed channels (Twitch follows, Kick-cross-linked). Re-fetch on connect
  // and re-poll for fresh live status. Token-derived, so it clears on logout.
  useEffect(() => {
    if (!twitchConnected) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFollowedChannels([]);
      return;
    }
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/twitch/followed");
        if (!res.ok) return;
        const { results } = (await res.json()) as { results: SearchResult[] };
        if (!cancelled) setFollowedChannels(results);
      } catch {
        /* ignore */
      }
    }
    load();
    // Heavier endpoint (follows + streams + Kick probes) — poll less often.
    const id = setInterval(load, 120_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [twitchConnected]);

  // Live status for your own Kick channel.
  useEffect(() => {
    if (!kickSlug) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setOwnKickStat(null);
      return;
    }
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/kick/stats");
        if (!res.ok) return;
        const json = (await res.json()) as { stats?: { isLive: boolean; viewers: number; profileImageUrl: string | null } | null };
        if (!cancelled && json.stats) {
          setOwnKickStat({ isLive: json.stats.isLive, viewers: json.stats.viewers, profileImageUrl: json.stats.profileImageUrl ?? null });
        }
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
  }, [kickSlug]);

  const ownKick = useMemo<KickOnlyChannel | null>(
    () =>
      kickSlug
        ? { slug: kickSlug.toLowerCase(), isLive: ownKickStat?.isLive ?? false, viewers: ownKickStat?.viewers ?? 0, profileImageUrl: ownKickStat?.profileImageUrl ?? null }
        : null,
    [kickSlug, ownKickStat]
  );

  // ── selection ────────────────────────────────────────────
  const selectChannel = useCallback((channel: FollowedChannel) => {
    setActiveKickOnly(null);
    setActiveChannel(channel);
    setPendingKick(null);
  }, []);

  const selectKickOnly = useCallback((slug: string) => {
    const s = slug.toLowerCase();
    setActiveChannel(null);
    setActiveKickOnly(s);
    setPendingKick({ slug: s, chatroomId: null });
  }, []);

  const clearSelection = useCallback(() => {
    setActiveChannel(null);
    setActiveKickOnly(null);
    setPendingKick(null);
    setActiveKick(null);
  }, []);

  // Role for the active selection — own Twitch/Kick = creator; a moderated
  // Twitch channel = moderator; else viewer.
  const activeRole: Role = activeChannel
    ? activeChannel.role
    : activeKickOnly && kickSlug && activeKickOnly.toLowerCase() === kickSlug.toLowerCase()
      ? "creator"
      : "viewer";

  // Resolve the pending Kick side into a live target (slug + chatroom id).
  // Strategy:
  //   1. If search already gave us a chatroomId, use it directly.
  //   2. Ask the server (/api/kick/resolve) which scans the official /livestreams
  //      API — works for any currently-live channel.
  //   3. Browser-side fallback: fetch kick.com/api/v2/channels/{slug} directly
  //      from the browser. Browser TLS fingerprint passes Cloudflare even though
  //      the same call is blocked when made from Node.js server-side. This gives
  //      us the definitive chatroom.id for any channel, live or offline.
  const pendingSlug = pendingKick?.slug ?? null;
  const pendingRoom = pendingKick?.chatroomId ?? null;
  useEffect(() => {
    let cancelled = false;
    if (!pendingSlug) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setActiveKick(null);
      return;
    }
    (async () => {
      let resolvedSlug = pendingSlug;
      // Start with the cached value (may be null or stale).
      let chatroomId: number | null = pendingRoom ?? null;

      // Try browser-side v2 fetch — passes Cloudflare when made from a real browser.
      // If this is blocked, the server-side fallback takes over.
      try {
        const v2 = await fetch(`https://kick.com/api/v2/channels/${encodeURIComponent(pendingSlug)}`);
        if (v2.ok) {
          const data = (await v2.json()) as { slug?: string; chatroom?: { id?: number } };
          const v2Id = data?.chatroom?.id ?? null;
          if (v2Id) {
            chatroomId = v2Id;
            if (data.slug) resolvedSlug = data.slug;
          }
        }
      } catch { /* CORS or network error */ }

      if (cancelled) return;

      // Server-side resolve — tries official /channels?slug= (chatroom.id) then /livestreams.
      if (!chatroomId) {
        try {
          const res = await fetch(`/api/kick/resolve?slug=${encodeURIComponent(pendingSlug)}`);
          if (res.ok) {
            const json = (await res.json()) as { exists?: boolean; slug?: string; chatroomId?: number | null };
            if (json.exists) {
              if (json.slug) resolvedSlug = json.slug;
              chatroomId = json.chatroomId ?? null;
            }
          }
        } catch { /* network error */ }
      }

      if (cancelled) return;
      setActiveKick(chatroomId ? { slug: resolvedSlug, chatroomId } : null);
    })();
    return () => { cancelled = true; };
  }, [pendingSlug, pendingRoom]);

  // ── self messages ────────────────────────────────────────
  const addSelfMessage = useCallback(
    (text: string, platforms: Platform[]) => {
      if (platforms.length === 0) return;
      const hasTwitch = platforms.includes("twitch");
      const hasKick = platforms.includes("kick");
      const user =
        hasTwitch && hasKick && ownChannel && kickSlug
          ? `${ownChannel.displayName} • ${kickSlug}`
          : hasTwitch
            ? (ownChannel?.displayName ?? "You")
            : hasKick
              ? (kickSlug ?? "You")
              : "You";
      const userByPlatform: Partial<Record<Platform, string>> = {
        ...(ownChannel ? { twitch: ownChannel.displayName } : {}),
        ...(kickSlug ? { kick: kickSlug } : {}),
      };
      const msg: ChatMessage = {
        id: `self-${Date.now()}-${Math.random()}`,
        platform: "self",
        platforms,
        user,
        userByPlatform,
        text,
        color: null,
        timestamp: Date.now(),
        seq: nextSeq(),
      };
      setSelfMessages((prev) => [...prev.slice(-50), msg]);
    },
    [ownChannel, kickSlug]
  );

  // Clear self messages when the selection changes.
  const selectionKey = activeChannel?.id ?? activeKickOnly ?? null;
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelfMessages([]);
  }, [selectionKey]);

  // ── live sockets ─────────────────────────────────────────
  // EventSub subscribes by broadcaster id, not login.
  const targetChannelId = activeChannel?.id ?? null;
  useEffect(() => {
    if (targetChannelId) connectTwitch(targetChannelId);
  }, [targetChannelId, connectTwitch]);

  const kickRoom = activeKick?.chatroomId ?? null;
  useEffect(() => {
    connectKick(kickRoom);
  }, [kickRoom, connectKick]);

  // Merge both feeds by client-arrival order (bounded). Ordering by `seq` — a
  // single monotonic counter stamped when each message reaches the browser —
  // rather than by `timestamp` is what stops Twitch and Kick messages (whose
  // timestamps come from different clocks) from reordering into the past. New
  // messages only ever append at the bottom. Socket echoes of a message we just
  // sent are dropped in favour of its single unified self entry.
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
      // Fail-safe: a message missing `seq` (should never happen — all three
      // producers stamp it) sorts to the END rather than mixing seq-domain
      // integers with epoch-ms timestamps, which would pin it wrongly.
      .sort((a, b) => (a.seq ?? Number.MAX_SAFE_INTEGER) - (b.seq ?? Number.MAX_SAFE_INTEGER))
      .slice(-300);
  }, [activeChannel, activeKickOnly, twitchMessages, kickMessages, selfMessages]);

  // ── @-mention participant registry ───────────────────────
  // A rolling record of who has chatted (per platform), kept in a ref so the
  // composer can query candidates on demand WITHOUT subscribing to the feed and
  // re-rendering on every message. Updated as raw socket messages arrive.
  const participantsRef = useRef<Map<string, MentionCandidate & { seq: number }>>(new Map());
  useEffect(() => {
    const reg = participantsRef.current;
    for (const m of [...twitchMessages, ...kickMessages]) {
      if (m.platform !== "twitch" && m.platform !== "kick") continue;
      const key = `${m.platform}:${m.user.toLowerCase()}`;
      const seq = m.seq ?? 0;
      const prev = reg.get(key);
      if (!prev || seq >= prev.seq) {
        reg.set(key, { user: m.user, platform: m.platform, color: m.color ?? null, userId: m.userId, seq });
      }
    }
    // Bound growth on very busy channels — keep the 500 most recent chatters.
    if (reg.size > 500) {
      const keep = [...reg.entries()].sort((a, b) => b[1].seq - a[1].seq).slice(0, 500);
      participantsRef.current = new Map(keep);
    }
  }, [twitchMessages, kickMessages]);

  // Clear the registry when the channel selection changes — a new channel has a
  // different chatter set.
  useEffect(() => {
    participantsRef.current = new Map();
  }, [selectionKey]);

  const getMentionCandidates = useCallback(
    (query: string, platforms: Platform[], limit = 6): MentionCandidate[] => {
      const q = query.toLowerCase();
      const allow = new Set(platforms);
      return [...participantsRef.current.values()]
        .filter((p) => allow.has(p.platform) && p.user.toLowerCase().startsWith(q))
        .sort((a, b) => b.seq - a.seq)
        .slice(0, limit)
        .map(({ user, platform, color, userId }) => ({ user, platform, color, userId }));
    },
    []
  );

  const getAllParticipants = useCallback(
    (platforms: Platform[]): MentionCandidate[] => {
      const allow = new Set(platforms);
      return [...participantsRef.current.values()]
        .filter((p) => allow.has(p.platform))
        .sort((a, b) => b.seq - a.seq)
        .map(({ user, platform, color, userId }) => ({ user, platform, color, userId }));
    },
    []
  );

  // Memoized so the reference stays stable across the frequent re-renders the
  // message feed triggers — consumers of channels/selection don't re-render.
  const chatValue = useMemo<ChatStore>(
    () => ({
      ownChannel,
      ownKick,
      activeChannel,
      activeKickOnly,
      activeRole,
      activeKick,
      kickConnected,
      watchedChannels,
      followedChannels,
      cheerLeaders,
      giftLeaders,
      selectChannel,
      selectKickOnly,
      selectSearchResult,
      clearSelection,
      addWatchedChannel,
      removeWatchedChannel,
      addSelfMessage,
      getMentionCandidates,
      getAllParticipants,
      beaconMode,
      setBeaconMode,
    }),
    [
      ownChannel, ownKick, activeChannel, activeKickOnly, activeRole, activeKick,
      kickConnected, watchedChannels, followedChannels, cheerLeaders, giftLeaders,
      selectChannel, selectKickOnly, selectSearchResult, clearSelection,
      addWatchedChannel, removeWatchedChannel, addSelfMessage, getMentionCandidates,
      getAllParticipants, beaconMode, setBeaconMode,
    ]
  );

  const messagesValue = useMemo<ChatMessages>(
    () => ({ status, messages }),
    [status, messages]
  );

  return (
    <ChatContext.Provider value={chatValue}>
      <ChatMessagesContext.Provider value={messagesValue}>
        {children}
      </ChatMessagesContext.Provider>
    </ChatContext.Provider>
  );
}

export function useChat(): ChatStore {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error("useChat must be used within a ChatProvider");
  return ctx;
}

export function useChatMessages(): ChatMessages {
  const ctx = useContext(ChatMessagesContext);
  if (!ctx) throw new Error("useChatMessages must be used within a ChatProvider");
  return ctx;
}
