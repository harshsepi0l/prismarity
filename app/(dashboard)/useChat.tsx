"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import type { ChatMessage, ConnectionStatus } from "./chat/types";
import type { FollowedChannel } from "@/lib/twitch/channels";
import { useTwitchChat } from "./chat/useTwitchChat";
import { useSession } from "./useSession";

// Chat session state lives in the dashboard layout, ABOVE the routes, so the
// live Twitch WebSocket, the followed-channel list, and the active selection
// survive navigating to Loyalty/VODs and back.
//
// Channels come from the Twitch connection — no manual entry. Click a followed
// channel to view its chat. TODO: moderated/viewer channel sources later.

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
  followedChannels: FollowedChannel[];
  activeChannel: FollowedChannel | null;
  selectChannel: (channel: FollowedChannel) => void;
  messagesPerMin: number;
}

const ChatContext = createContext<ChatStore | null>(null);

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const { messages: liveMessages, status, connect } = useTwitchChat();
  const { activeFilters } = useSession();

  const [followedChannels, setFollowedChannels] = useState<FollowedChannel[]>([]);
  const [activeChannel, setActiveChannel] = useState<FollowedChannel | null>(null);
  const [demoMessages, setDemoMessages] = useState<ChatMessage[]>([]);
  const [messagesPerMin, setMessagesPerMin] = useState(0);

  // Load followed channels from the user's Twitch connection (server-side),
  // then refresh periodically to keep live status / viewer counts current.
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/twitch/followed");
        if (!res.ok) return;
        const json = (await res.json()) as { channels?: FollowedChannel[] };
        const channels = json.channels ?? [];
        if (cancelled) return;
        setFollowedChannels(channels);
        setActiveChannel((prev) =>
          prev ? channels.find((c) => c.id === prev.id) ?? prev : prev
        );
      } catch {
        /* ignore network errors */
      }
    }
    load();
    const id = setInterval(load, 60_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const selectChannel = useCallback((channel: FollowedChannel) => {
    setActiveChannel(channel);
  }, []);

  // Connect the live feed to the selected channel.
  const targetLogin = activeChannel?.login ?? null;
  useEffect(() => {
    if (targetLogin) connect(targetLogin);
  }, [targetLogin, connect]);

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

  // Rolling messages/min, computed off the render path (Date.now is impure).
  // Refs hold the latest values so the interval reads them without resetting.
  const liveRef = useRef(liveMessages);
  const activeRef = useRef(false);
  useEffect(() => {
    liveRef.current = liveMessages;
    activeRef.current = activeChannel !== null;
  });
  useEffect(() => {
    const id = setInterval(() => {
      const cutoff = Date.now() - 60_000;
      setMessagesPerMin(
        activeRef.current
          ? liveRef.current.filter((m) => m.timestamp > cutoff).length
          : 0
      );
    }, 3000);
    return () => clearInterval(id);
  }, []);

  const baseMessages = activeChannel ? liveMessages : [];
  const allMessages = [...baseMessages, ...demoMessages].sort(
    (a, b) => a.timestamp - b.timestamp
  );

  return (
    <ChatContext.Provider
      value={{
        status,
        allMessages,
        followedChannels,
        activeChannel,
        selectChannel,
        messagesPerMin,
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
