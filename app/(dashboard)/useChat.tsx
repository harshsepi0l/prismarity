"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import type { ChatMessage, ConnectionStatus } from "./chat/types";
import type { FollowedChannel } from "@/lib/twitch/channels";
import { useTwitchChat } from "./chat/useTwitchChat";

// Chat session state lives in the dashboard layout, ABOVE the routes, so the
// live Twitch WebSocket, the channel list, and the active selection survive
// navigating to Loyalty/VODs and back.
//
// Channels come from the Twitch connection — no manual entry. Each carries the
// user's role for it (creator = your own channel, moderator, or viewer).

interface ChatStore {
  status: ConnectionStatus;
  messages: ChatMessage[];
  ownChannel: FollowedChannel | null;
  followedChannels: FollowedChannel[];
  activeChannel: FollowedChannel | null;
  selectChannel: (channel: FollowedChannel) => void;
}

const ChatContext = createContext<ChatStore | null>(null);

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const { messages: liveMessages, status, connect } = useTwitchChat();

  const [ownChannel, setOwnChannel] = useState<FollowedChannel | null>(null);
  const [followedChannels, setFollowedChannels] = useState<FollowedChannel[]>([]);
  const [activeChannel, setActiveChannel] = useState<FollowedChannel | null>(null);

  // Load own + followed channels from the user's Twitch connection (server-side),
  // then refresh periodically to keep live status / viewer counts current.
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
        // Keep the active channel's live status / role in sync.
        setActiveChannel((prev) => {
          if (!prev) return prev;
          const all = own ? [own, ...followed] : followed;
          return all.find((c) => c.id === prev.id) ?? prev;
        });
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

  const messages = activeChannel ? liveMessages : [];

  return (
    <ChatContext.Provider
      value={{
        status,
        messages,
        ownChannel,
        followedChannels,
        activeChannel,
        selectChannel,
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
