"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { ChatMessage, ConnectionStatus, Platform, SearchResult } from "./chat/types";
import type { FollowedChannel } from "@/lib/twitch/channels";
import type { Role } from "@/lib/auth/types";
import { useTwitchChat, type CheerLeader, type GiftLeader } from "./chat/useTwitchChat";
import { useKickChat } from "./chat/useKickChat";

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
}

interface PendingKick {
  slug: string;
  chatroomId: number | null;
}

interface ChatStore {
  status: ConnectionStatus;
  messages: ChatMessage[];
  ownChannel: FollowedChannel | null;
  ownKick: KickOnlyChannel | null;
  activeChannel: FollowedChannel | null;
  activeKickOnly: string | null; // slug, when a Kick-only selection is active
  activeRole: Role;
  activeKick: ActiveKick | null;
  kickConnected: boolean;
  // Live, session-scoped tallies for the active Twitch channel (see
  // useTwitchChat for why these aren't Twitch's actual weekly numbers).
  cheerLeaders: CheerLeader[];
  giftLeaders: GiftLeader[];
  selectChannel: (channel: FollowedChannel) => void;
  selectKickOnly: (slug: string) => void;
  selectSearchResult: (result: SearchResult) => void;
  addSelfMessage: (text: string, platforms: Platform[]) => void;
}

const ChatContext = createContext<ChatStore | null>(null);

export function ChatProvider({
  kickSlug = null,
  children,
}: {
  kickSlug?: string | null; // the logged-in user's own Kick slug (if connected)
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

  const [ownChannel, setOwnChannel] = useState<FollowedChannel | null>(null);
  const [ownKickStat, setOwnKickStat] = useState<{ isLive: boolean; viewers: number } | null>(null);
  const [activeChannel, setActiveChannel] = useState<FollowedChannel | null>(null);
  const [activeKickOnly, setActiveKickOnly] = useState<string | null>(null);
  const [pendingKick, setPendingKick] = useState<PendingKick | null>(null);
  const [activeKick, setActiveKick] = useState<ActiveKick | null>(null);
  const [selfMessages, setSelfMessages] = useState<ChatMessage[]>([]);

  // Pin your own Twitch channel (creator), refreshing live status periodically.
  useEffect(() => {
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
  }, []);

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
        const json = (await res.json()) as { stats?: { isLive: boolean; viewers: number } | null };
        if (!cancelled && json.stats) {
          setOwnKickStat({ isLive: json.stats.isLive, viewers: json.stats.viewers });
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
        ? { slug: kickSlug.toLowerCase(), isLive: ownKickStat?.isLive ?? false, viewers: ownKickStat?.viewers ?? 0 }
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

  // Select a unified search result — wires up whichever platforms it spans.
  const selectSearchResult = useCallback((result: SearchResult) => {
    if (result.twitch) {
      const t = result.twitch;
      setActiveKickOnly(null);
      setActiveChannel({
        id: t.id,
        login: t.login,
        displayName: t.displayName,
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

  // Role for the active selection — own Twitch/Kick = creator; a moderated
  // Twitch channel = moderator; else viewer.
  const activeRole: Role = activeChannel
    ? activeChannel.role
    : activeKickOnly && kickSlug && activeKickOnly.toLowerCase() === kickSlug.toLowerCase()
      ? "creator"
      : "viewer";

  // Resolve the pending Kick side into a live target (slug + chatroom id).
  const pendingSlug = pendingKick?.slug ?? null;
  const pendingRoom = pendingKick?.chatroomId ?? null;
  useEffect(() => {
    let cancelled = false;
    if (!pendingSlug) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setActiveKick(null);
      return;
    }
    if (pendingRoom) {
      setActiveKick({ slug: pendingSlug, chatroomId: pendingRoom });
      return;
    }
    (async () => {
      try {
        const res = await fetch(`/api/kick/resolve?slug=${encodeURIComponent(pendingSlug)}`);
        const json = (await res.json()) as { exists?: boolean; slug?: string; chatroomId?: number | null };
        if (cancelled) return;
        setActiveKick(json.exists && json.chatroomId ? { slug: json.slug ?? pendingSlug, chatroomId: json.chatroomId } : null);
      } catch {
        if (!cancelled) setActiveKick(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pendingSlug, pendingRoom]);

  // ── self messages ────────────────────────────────────────
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

  // Merge both feeds chronologically (bounded). Socket echoes of a message we
  // just sent are dropped in favour of its single unified self entry.
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
        ownKick,
        activeChannel,
        activeKickOnly,
        activeRole,
        activeKick,
        kickConnected,
        cheerLeaders,
        giftLeaders,
        selectChannel,
        selectKickOnly,
        selectSearchResult,
        addSelfMessage,
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
