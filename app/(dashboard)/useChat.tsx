"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";
import type { ChatMessage, ConnectionStatus } from "./chat/types";
import { useTwitchChat } from "./chat/useTwitchChat";
import { useSession } from "./useSession";

// Chat session state lives in the dashboard layout, ABOVE the routes, so the
// live Twitch WebSocket and history survive navigating to Loyalty/VODs and back.
//
// Channels come from the Twitch connection — there is no manual channel entry:
//   creator   -> your own channel (the logged-in Twitch login)
//   moderator -> TODO: channels you moderate, from Helix moderated-channels
//   viewer    -> TODO: channels you follow / browse, from Twitch

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
}

const ChatContext = createContext<ChatStore | null>(null);

export function ChatProvider({
  creatorLogin,
  children,
}: {
  creatorLogin: string | null;
  children: React.ReactNode;
}) {
  const { messages: liveMessages, status, connect } = useTwitchChat();
  const { mode, activeFilters } = useSession();
  const [demoMessages, setDemoMessages] = useState<ChatMessage[]>([]);

  // Only the creator's own channel is wired to the live feed for now.
  const targetChannel = mode === "creator" ? creatorLogin : null;

  useEffect(() => {
    if (targetChannel) connect(targetChannel);
  }, [targetChannel, connect]);

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

  const baseMessages = mode === "creator" ? liveMessages : [];
  const allMessages = [...baseMessages, ...demoMessages].sort(
    (a, b) => a.timestamp - b.timestamp
  );

  return (
    <ChatContext.Provider value={{ status, allMessages }}>
      {children}
    </ChatContext.Provider>
  );
}

export function useChat(): ChatStore {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error("useChat must be used within a ChatProvider");
  return ctx;
}
