"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import type { ChatMessage, ConnectionStatus } from "./chat/types";
import { useTwitchChat } from "./chat/useTwitchChat";
import { useSession } from "./useSession";

// This store lives in the dashboard layout, ABOVE the routes. A Next.js layout
// does not remount when navigating between sibling routes, so the chat session —
// including the live Twitch WebSocket and message history — survives moving to
// Loyalty/VODs and back.

// TODO: in creator mode the channel will come from the authenticated streamer
// account once OAuth exists. Until then it's stored in localStorage.
const CREATOR_CHANNEL_KEY = "prismarity:creator-channel";

const DEMO_POOL: Record<"youtube" | "kick", Array<{ user: string; text: string }>> = {
  youtube: [
    { user: "StreamFan99", text: "Great stream!" },
    { user: "VideoViewer", text: "Love the content 🔥" },
    { user: "YTWatcher", text: "First time here, this is sick" },
    { user: "SubbedFan", text: "Been watching for an hour, incredible" },
  ],
  kick: [
    { user: "KickUser42", text: "PogChamp" },
    { user: "GreenStreamer", text: "This is way better on Kick" },
    { user: "NewViewer", text: "Just found the stream 👀" },
    { user: "ChatGoblin", text: "KEKW" },
  ],
};

function makeDemoMessage(platform: "youtube" | "kick"): ChatMessage {
  const pool = DEMO_POOL[platform];
  const base = pool[Math.floor(Math.random() * pool.length)];
  return {
    id: `${platform}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    platform,
    user: base.user,
    text: base.text,
    color: null,
    timestamp: Date.now(),
    demo: true,
  };
}

interface ChatStore {
  status: ConnectionStatus;
  allMessages: ChatMessage[];
  creatorChannel: string;
  saveCreatorChannel: (channel: string) => void;
  viewerChannels: string[];
  activeChannel: string | null;
  setActiveChannel: (channel: string | null) => void;
  addViewerChannel: (channel: string) => void;
  closeChannel: (channel: string) => void;
}

const ChatContext = createContext<ChatStore | null>(null);

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const { messages: liveMessages, status, connect } = useTwitchChat();
  const { mode, activeFilters } = useSession();

  const [creatorChannel, setCreatorChannel] = useState("");
  const [viewerChannels, setViewerChannels] = useState<string[]>([]);
  const [activeChannel, setActiveChannel] = useState<string | null>(null);
  const [channelHistory, setChannelHistory] = useState<Record<string, ChatMessage[]>>({});
  const [demoMessages, setDemoMessages] = useState<ChatMessage[]>([]);

  // Load the saved creator channel once on mount.
  useEffect(() => {
    const saved = localStorage.getItem(CREATOR_CHANNEL_KEY);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (saved) setCreatorChannel(saved);
  }, []);

  // The channel the hook should be connected to depends on the current mode.
  const targetChannel = mode === "creator" ? creatorChannel : activeChannel;

  useEffect(() => {
    if (targetChannel) connect(targetChannel);
  }, [targetChannel, connect]);

  // In viewer/moderator mode, merge live messages into the active channel's
  // history so switching tabs (which reconnects the hook) never loses scrollback.
  useEffect(() => {
    if (mode === "creator" || !activeChannel) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setChannelHistory((prev) => {
      const existing = prev[activeChannel] ?? [];
      const seen = new Set(existing.map((m) => m.id));
      const additions = liveMessages.filter((m) => !seen.has(m.id));
      if (additions.length === 0) return prev;
      return { ...prev, [activeChannel]: [...existing, ...additions].slice(-200) };
    });
  }, [liveMessages, activeChannel, mode]);

  const saveCreatorChannel = useCallback((channel: string) => {
    setCreatorChannel(channel);
    localStorage.setItem(CREATOR_CHANNEL_KEY, channel);
  }, []);

  const addViewerChannel = useCallback((channel: string) => {
    setViewerChannels((prev) => (prev.includes(channel) ? prev : [...prev, channel]));
    setActiveChannel(channel);
  }, []);

  const closeChannel = useCallback((channel: string) => {
    setViewerChannels((prev) => {
      const remaining = prev.filter((c) => c !== channel);
      setActiveChannel((cur) =>
        cur === channel ? (remaining.length ? remaining[remaining.length - 1] : null) : cur
      );
      return remaining;
    });
    setChannelHistory((prev) => {
      const next = { ...prev };
      delete next[channel];
      return next;
    });
  }, []);

  // Demo YouTube + Kick messages, only when those filters are on.
  useEffect(() => {
    const hasYT = activeFilters.has("youtube");
    const hasKick = activeFilters.has("kick");
    if (!hasYT && !hasKick) return;

    const id = setInterval(() => {
      const candidates: Array<"youtube" | "kick"> = [];
      if (hasYT) candidates.push("youtube");
      if (hasKick) candidates.push("kick");
      const pick = candidates[Math.floor(Math.random() * candidates.length)];
      setDemoMessages((prev) => [...prev.slice(-49), makeDemoMessage(pick)]);
    }, 3500);

    return () => clearInterval(id);
  }, [activeFilters]);

  const baseMessages =
    mode === "creator"
      ? liveMessages
      : activeChannel
        ? channelHistory[activeChannel] ?? []
        : [];

  const allMessages = [...baseMessages, ...demoMessages].sort(
    (a, b) => a.timestamp - b.timestamp
  );

  return (
    <ChatContext.Provider
      value={{
        status,
        allMessages,
        creatorChannel,
        saveCreatorChannel,
        viewerChannels,
        activeChannel,
        setActiveChannel,
        addViewerChannel,
        closeChannel,
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
