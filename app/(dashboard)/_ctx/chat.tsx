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
import type { ChatMessage, ConnectionStatus, Platform, SearchResult, PinItem, HypeTrain } from "../types";
import type { FollowedChannel } from "@/lib/twitch/channels";
import type { Role } from "@/lib/auth/types";
import { useTwitchChat, type CheerLeader, type GiftLeader } from "../chat/useTwitchChat";
import type { PinnedMessage } from "@/lib/twitch/pins";
import { useKickChat } from "../chat/useKickChat";
import { nextSeq } from "../chat/seq";
import { participantRole, isKnownBot, type ParticipantRole } from "../chat/participantRole";

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
  // Role bucket for the participants roster (Broadcaster/Mods/VIPs/Bots/Viewers),
  // derived from the chatter's badges. Absent = viewer. Ignored by @mentions.
  role?: ParticipantRole;
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
  // Whether the current selection is live per platform (from the search match).
  // Drives the watch/send live-gate — offline platforms are not watched or sent to.
  liveByPlatform: Partial<Record<Platform, boolean>>;
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

// Pinned/banner-bar state for the active channel. Lives in its own context so
// its changes don't ride on chatValue — which changes on every cheer/gift/
// watched-channel poll. Twitch-only, READ-ONLY: `pinItems` is the merged,
// cycleable bar (the real pinned message + Hype Train + announcements + raids),
// all read from Twitch. No pinning/unpinning here — that's a mod action we're
// deliberately not implementing yet.
interface ChatPins {
  // Everything to show in the cycle bar, in display order.
  pinItems: PinItem[];
}

const ChatContext = createContext<ChatStore | null>(null);
const ChatMessagesContext = createContext<ChatMessages | null>(null);
const ChatPinsContext = createContext<ChatPins | null>(null);
// Connection state for the beacon signal art lives in its own context so its
// per-connect transitions don't re-render every useChat consumer (NavRail,
// Settings, roster…) — only the beacon art subscribes here.
const ChatSignalContext = createContext<ConnectionStatus>("idle");

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
    liveEvents,
  } = useTwitchChat();
  const { messages: kickMessages, status: kickStatus, connect: connectKick } = useKickChat();

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
  // Whether the current selection is live on Kick, per the search match. Twitch's
  // equivalent is activeChannel.isLive. Drives the watch/send live-gate.
  const [activeKickLive, setActiveKickLive] = useState(false);
  const [pendingKick, setPendingKick] = useState<PendingKick | null>(null);
  const [activeKick, setActiveKick] = useState<ActiveKick | null>(null);
  const [selfMessages, setSelfMessages] = useState<ChatMessage[]>([]);
  const [pinnedData, setPinnedData] = useState<PinnedMessage | null>(null);
  const [hypeTrain, setHypeTrain] = useState<HypeTrain | null>(null);
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
    // Kick live status comes straight from the match (there's no live socket yet).
    setActiveKickLive(!!result.kick?.isLive);
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
    setActiveKickLive(false); // Twitch-only selection — no Kick side
    setActiveChannel(channel);
    setPendingKick(null);
  }, []);

  const selectKickOnly = useCallback((slug: string) => {
    const s = slug.toLowerCase();
    setActiveChannel(null);
    setActiveKickOnly(s);
    // No match live flag on this path (own/direct Kick) — assume live so we don't
    // wrongly hide a channel the user explicitly picked.
    setActiveKickLive(true);
    setPendingKick({ slug: s, chatroomId: null });
  }, []);

  const clearSelection = useCallback(() => {
    setActiveChannel(null);
    setActiveKickOnly(null);
    setActiveKickLive(false);
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

  // Clear self messages and any pin when the selection changes — a new channel
  // has its own (real, Twitch-side) pin, tracked fresh from this session.
  const selectionKey = activeChannel?.id ?? activeKickOnly ?? null;
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelfMessages([]);
    setPinnedData(null);
    setHypeTrain(null);
  }, [selectionKey]);

  // ── pinned message + banner bar (Twitch, read-only) ──────
  // The real pinned message AND active Hype Train are read for ANY channel via
  // Twitch's anonymous GQL (/api/twitch/banner) — no mod role, no scope. We poll
  // it, so pins set from Twitch's own UI / by mods show up too. Display only —
  // pinning/unpinning is a mod action we're not implementing.
  const pollBanner = useCallback(async () => {
    if (!activeChannel) return;
    try {
      const res = await fetch(`/api/twitch/banner?channelId=${encodeURIComponent(activeChannel.id)}`);
      if (!res.ok) return;
      const { pin, hypeTrain: ht } = (await res.json()) as {
        pin: PinnedMessage | null;
        hypeTrain: HypeTrain | null;
      };
      setHypeTrain(ht);
      setPinnedData(pin); // GQL carries text/sender/badges/pinnedBy/sentAt in full
    } catch {
      /* network — keep whatever we last had */
    }
  }, [activeChannel]);

  // Poll the banner on connect and every 15s, for ANY active Twitch channel.
  useEffect(() => {
    if (!activeChannel) return;
    let cancelled = false;
    async function run() {
      if (!cancelled) await pollBanner();
    }
    run();
    const id = setInterval(run, 15_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [activeChannel, pollBanner]);

  // Age out transient banner events (announcements, raids). liveEvents changes
  // when new ones arrive, but expiry alone wouldn't re-render — this clock ticks
  // while any are in flight so the pinItems memo re-evaluates. Starts at 0 (all
  // events read as fresh) until the first tick, which is fine — they just arrived.
  const [now, setNow] = useState(0);
  useEffect(() => {
    if (liveEvents.length === 0) return;
    const id = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(id);
  }, [liveEvents.length]);

  // The merged, cycleable bar: active Hype Train first, then the mod-pin, then
  // recent (<30s) transient events in arrival order.
  const pinItems = useMemo<PinItem[]>(() => {
    const items: PinItem[] = [];
    if (hypeTrain) items.push({ kind: "hype_train", id: "hype-train", hype: hypeTrain });
    if (pinnedData) {
      items.push({
        kind: "message",
        id: pinnedData.messageId,
        user: pinnedData.user ?? "",
        color: pinnedData.color,
        text: pinnedData.text,
        pinnedBy: pinnedData.pinnedBy,
        sentAt: pinnedData.sentAt,
        badges: pinnedData.badges,
      });
    }
    for (const ev of liveEvents) {
      if (now - ev.at > 30_000) continue;
      if (ev.kind === "announcement") {
        items.push({ kind: "announcement", id: ev.id, user: ev.user, color: ev.color, text: ev.text });
      } else if (ev.kind === "raid") {
        items.push({ kind: "raid", id: ev.id, from: ev.from, viewers: ev.viewers });
      } else {
        items.push({ kind: "gift_sub", id: ev.id, gifter: ev.gifter, count: ev.count });
      }
    }
    return items;
  }, [hypeTrain, pinnedData, liveEvents, now]);

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

  // Connection state driving the beacon signal art, collapsed across whichever
  // platforms the current selection spans. A freshly-selected channel reads as
  // "connecting" (its socket is still handshaking, or hasn't been told to yet)
  // so the bars scan the instant you swap streamers, then settle once live.
  const signalStatus: ConnectionStatus = useMemo(() => {
    const parts: ConnectionStatus[] = [];
    if (targetChannelId) parts.push(status);
    if (kickRoom != null) parts.push(kickStatus);
    if (parts.length === 0) return "idle";
    if (parts.some((s) => s === "connecting" || s === "idle")) return "connecting";
    if (parts.some((s) => s === "connected")) return "connected";
    return "error";
  }, [targetChannelId, kickRoom, status, kickStatus]);

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
        reg.set(key, {
          user: m.user,
          platform: m.platform,
          color: m.color ?? null,
          userId: m.userId,
          role: participantRole(m.user, m.badges),
          seq,
        });
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

  // Seed the registry with the broadcaster + real mods/VIPs — the SAME roster the
  // participants window shows (broadcaster from the selection, Twitch mods/VIPs
  // via ivr.fi) — so @-mentions can reach people who haven't chatted yet. Runs
  // after the clear effect above on each channel switch; never overwrites a
  // richer entry from an actual chat message.
  const rosterTwitchLogin = activeChannel?.login ?? null;
  const rosterTwitchName = activeChannel?.displayName ?? null;
  const rosterTwitchId = activeChannel?.id ?? null;
  const rosterKickSlug = activeKick?.slug ?? activeKickOnly;
  useEffect(() => {
    const inject = (c: MentionCandidate) => {
      const key = `${c.platform}:${c.user.toLowerCase()}`;
      if (!participantsRef.current.has(key)) {
        participantsRef.current.set(key, { ...c, seq: nextSeq() });
      }
    };
    if (rosterTwitchName)
      inject({ user: rosterTwitchName, platform: "twitch", color: null, userId: rosterTwitchId ?? undefined, role: "broadcaster" });
    if (rosterKickSlug)
      inject({ user: rosterKickSlug, platform: "kick", color: null, role: "broadcaster" });
    if (!rosterTwitchLogin) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/twitch/modvip?login=${encodeURIComponent(rosterTwitchLogin)}`);
        if (!res.ok) return;
        const j = (await res.json()) as { mods?: { user: string; id?: string }[]; vips?: { user: string; id?: string }[] };
        if (cancelled) return;
        for (const v of j.vips ?? [])
          inject({ user: v.user, platform: "twitch", color: null, userId: v.id, role: isKnownBot(v.user) ? "bot" : "vip" });
        for (const m of j.mods ?? [])
          inject({ user: m.user, platform: "twitch", color: null, userId: m.id, role: isKnownBot(m.user) ? "bot" : "moderator" });
      } catch {
        /* ignore — mentions degrade to observed chatters */
      }
    })();
    return () => { cancelled = true; };
  }, [rosterTwitchLogin, rosterTwitchName, rosterTwitchId, rosterKickSlug]);

  const getMentionCandidates = useCallback(
    (query: string, platforms: Platform[], limit = 6): MentionCandidate[] => {
      const q = query.toLowerCase();
      const allow = new Set(platforms);
      return [...participantsRef.current.values()]
        .filter((p) => allow.has(p.platform) && p.user.toLowerCase().startsWith(q))
        .sort((a, b) => b.seq - a.seq)
        .slice(0, limit)
        .map(({ user, platform, color, userId, role }) => ({ user, platform, color, userId, role }));
    },
    []
  );

  const getAllParticipants = useCallback(
    (platforms: Platform[]): MentionCandidate[] => {
      const allow = new Set(platforms);
      return [...participantsRef.current.values()]
        .filter((p) => allow.has(p.platform))
        .sort((a, b) => b.seq - a.seq)
        .map(({ user, platform, color, userId, role }) => ({ user, platform, color, userId, role }));
    },
    []
  );

  // Live-per-platform for the active selection (from the match). Twitch reads its
  // live flag off the active channel; Kick off the match-derived state above.
  const liveByPlatform = useMemo(
    () => ({ twitch: activeChannel?.isLive ?? false, kick: activeKickLive }),
    [activeChannel, activeKickLive]
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
      liveByPlatform,
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
      kickConnected, liveByPlatform, watchedChannels, followedChannels, cheerLeaders, giftLeaders,
      selectChannel, selectKickOnly, selectSearchResult, clearSelection,
      addWatchedChannel, removeWatchedChannel, addSelfMessage, getMentionCandidates,
      getAllParticipants, beaconMode, setBeaconMode,
    ]
  );

  const messagesValue = useMemo<ChatMessages>(
    () => ({ status, messages }),
    [status, messages]
  );

  const pinsValue = useMemo<ChatPins>(() => ({ pinItems }), [pinItems]);

  return (
    <ChatContext.Provider value={chatValue}>
      <ChatSignalContext.Provider value={signalStatus}>
        <ChatPinsContext.Provider value={pinsValue}>
          <ChatMessagesContext.Provider value={messagesValue}>
            {children}
          </ChatMessagesContext.Provider>
        </ChatPinsContext.Provider>
      </ChatSignalContext.Provider>
    </ChatContext.Provider>
  );
}

// Connection state for the active selection, driving the beacon signal art
// (idle/connecting → scanning, connected → strong). Separate from useChat so
// its transitions don't re-render channel/selection consumers.
export function useChatSignal(): ConnectionStatus {
  return useContext(ChatSignalContext);
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

// Pinned-message state + pin/unpin actions for the active channel. Separate from
// useChat so its changes don't re-render channel/selection consumers.
export function useChatPins(): ChatPins {
  const ctx = useContext(ChatPinsContext);
  if (!ctx) throw new Error("useChatPins must be used within a ChatProvider");
  return ctx;
}
