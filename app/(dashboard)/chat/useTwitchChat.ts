"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { ChatMessage, ConnectionStatus } from "../types";

export interface CheerLeader {
  user: string;
  bits: number;
}

export interface GiftLeader {
  user: string;
  gifts: number;
}

interface UseTwitchChatReturn {
  messages: ChatMessage[];
  status: ConnectionStatus;
  connect: (channelId: string) => void;
  // Live tallies for the current channel connection — not Twitch's actual
  // weekly leaderboard (that data isn't exposed for channels that aren't
  // yours), just a running count from whenever you tuned in. Resets on
  // every connect() / channel switch.
  cheerLeaders: CheerLeader[];
  giftLeaders: GiftLeader[];
}

const EVENTSUB_URL = "wss://eventsub.wss.twitch.tv/ws";

interface EmoteFragment {
  type: string;
  text: string;
  emote?: { id: string };
}

interface ChatBadge {
  set_id: string;
  id: string;
}

interface ChatMessageEvent {
  message_id: string;
  chatter_user_id: string;
  chatter_user_name: string;
  color: string | null;
  badges?: ChatBadge[];
  message: { text: string; fragments?: EmoteFragment[] };
  cheer?: { bits: number } | null;
}

// channel.chat.notification — sub/resub/gift/raid system messages that
// appear in chat. We only care about the gift-sub varieties here.
interface SubGiftInfo {
  total: number;
  gifter_is_anonymous?: boolean;
  gifter_user_name?: string;
}
interface CommunitySubGiftInfo {
  total: number;
}
interface ChatNotificationEvent {
  notice_type: string;
  chatter_user_name: string;
  sub_gift?: SubGiftInfo;
  community_sub_gift?: CommunitySubGiftInfo;
}

interface EventSubFrame {
  metadata: {
    message_type:
      | "session_welcome"
      | "session_keepalive"
      | "notification"
      | "session_reconnect"
      | "revocation";
  };
  payload: {
    session?: { id: string; keepalive_timeout_seconds?: number; reconnect_url?: string };
    subscription?: { type?: string };
    event?: ChatMessageEvent | ChatNotificationEvent;
  };
}

function emoteUrl(id: string): string {
  return `https://static-cdn.jtvnw.net/emoticons/v2/${id}/default/dark/2.0`;
}

// Twitch emotes arrive as structured fragments now, not an IRC tag to parse.
function nativeEmotesFromFragments(fragments: EmoteFragment[]): Record<string, string> | undefined {
  const map: Record<string, string> = {};
  for (const f of fragments) {
    if (f.type === "emote" && f.emote) map[f.text] = emoteUrl(f.emote.id);
  }
  return Object.keys(map).length ? map : undefined;
}

export function useTwitchChat(): UseTwitchChatReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [status, setStatus] = useState<ConnectionStatus>("idle");
  const wsRef = useRef<WebSocket | null>(null);
  const keepaliveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Uncapped running totals (unlike `messages`, which trims to the last 200
  // for display) — these must keep accumulating for the whole connection.
  const cheerTotals = useRef<Map<string, number>>(new Map());
  const giftTotals = useRef<Map<string, number>>(new Map());
  const [cheerLeaders, setCheerLeaders] = useState<CheerLeader[]>([]);
  const [giftLeaders, setGiftLeaders] = useState<GiftLeader[]>([]);

  function bumpCheer(user: string, bits: number) {
    cheerTotals.current.set(user, (cheerTotals.current.get(user) ?? 0) + bits);
    setCheerLeaders(
      [...cheerTotals.current.entries()]
        .map(([u, b]) => ({ user: u, bits: b }))
        .sort((a, b) => b.bits - a.bits)
        .slice(0, 10)
    );
  }

  function bumpGift(user: string, gifts: number) {
    giftTotals.current.set(user, (giftTotals.current.get(user) ?? 0) + gifts);
    setGiftLeaders(
      [...giftTotals.current.entries()]
        .map(([u, g]) => ({ user: u, gifts: g }))
        .sort((a, b) => b.gifts - a.gifts)
        .slice(0, 10)
    );
  }
  // `open` recurses (reconnect-on-timeout, reconnect-on-migration) — routed
  // through a ref instead of calling itself by name, since it's wrapped in
  // useCallback and can't reference its own not-yet-bound const.
  const openRef = useRef<(channelId: string, url: string, isMigration: boolean) => void>(() => {});

  // Opens an EventSub WebSocket and, once it's live, registers the
  // subscription server-side. `isMigration` is true only when following a
  // `session_reconnect` hand-off — the subscription already transfers to the
  // new session automatically there, so we must NOT re-subscribe.
  const open = useCallback((channelId: string, url: string, isMigration: boolean) => {
    const ws = new WebSocket(url);
    wsRef.current = ws;

    const armKeepalive = (seconds: number) => {
      if (keepaliveTimer.current) clearTimeout(keepaliveTimer.current);
      // Twitch sends a keepalive (or a notification) at least this often. No
      // signal at all past that means the socket is stalled with no other
      // indication — reconnect from scratch rather than wait indefinitely.
      keepaliveTimer.current = setTimeout(() => {
        if (wsRef.current === ws) openRef.current(channelId, EVENTSUB_URL, false);
      }, (seconds + 5) * 1000);
    };

    ws.onmessage = (event: MessageEvent<string>) => {
      if (wsRef.current !== ws) return; // stale socket superseded by a newer connect/migration
      let frame: EventSubFrame;
      try {
        frame = JSON.parse(event.data) as EventSubFrame;
      } catch {
        return;
      }

      switch (frame.metadata.message_type) {
        case "session_welcome": {
          const session = frame.payload.session;
          if (!session) return;
          armKeepalive(session.keepalive_timeout_seconds ?? 10);
          if (isMigration) {
            setStatus("connected");
            return;
          }
          fetch("/api/twitch/subscribe", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ channelId, sessionId: session.id }),
          })
            .then((r) => {
              if (wsRef.current === ws) setStatus(r.ok ? "connected" : "error");
            })
            .catch(() => {
              if (wsRef.current === ws) setStatus("error");
            });
          break;
        }

        case "session_keepalive":
          armKeepalive(10);
          break;

        case "notification": {
          armKeepalive(10);
          const subType = frame.payload.subscription?.type;

          if (subType === "channel.chat.message") {
            const e = frame.payload.event as ChatMessageEvent | undefined;
            if (!e) return;
            if (e.cheer?.bits) bumpCheer(e.chatter_user_name, e.cheer.bits);
            setMessages((prev) => [
              ...prev.slice(-199),
              {
                id: e.message_id,
                platform: "twitch",
                user: e.chatter_user_name,
                userId: e.chatter_user_id,
                text: e.message.text,
                color: e.color || null,
                timestamp: Date.now(),
                nativeEmotes: nativeEmotesFromFragments(e.message.fragments ?? []),
                badges: e.badges?.map((b) => ({ setId: b.set_id, id: b.id })) ?? [],
              },
            ]);
          } else if (subType === "channel.chat.notification") {
            const e = frame.payload.event as ChatNotificationEvent | undefined;
            if (!e) return;
            // Field shapes here are best-effort from docs (no live payload to
            // confirm against) — prefer the nested gifter identity since the
            // top-level chatter can represent the recipient instead for a
            // single sub_gift, falling back if it's missing or anonymous.
            if (e.notice_type === "sub_gift" && e.sub_gift && !e.sub_gift.gifter_is_anonymous) {
              const gifter = e.sub_gift.gifter_user_name ?? e.chatter_user_name;
              bumpGift(gifter, 1);
            } else if (e.notice_type === "community_sub_gift" && e.community_sub_gift) {
              bumpGift(e.chatter_user_name, e.community_sub_gift.total);
            }
          }
          break;
        }

        case "session_reconnect": {
          const reconnectUrl = frame.payload.session?.reconnect_url;
          if (reconnectUrl) openRef.current(channelId, reconnectUrl, true);
          break;
        }

        case "revocation":
          setStatus("error");
          break;
      }
    };

    ws.onerror = () => {
      if (wsRef.current === ws) setStatus("error");
    };
    ws.onclose = () => {
      if (wsRef.current === ws) setStatus("idle");
    };
  }, []);

  useEffect(() => {
    openRef.current = open;
  }, [open]);

  const connect = useCallback(
    (channelId: string) => {
      if (keepaliveTimer.current) clearTimeout(keepaliveTimer.current);
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
        wsRef.current = null;
      }
      setMessages([]);
      setStatus("connecting");
      cheerTotals.current = new Map();
      giftTotals.current = new Map();
      setCheerLeaders([]);
      setGiftLeaders([]);
      open(channelId, EVENTSUB_URL, false);
    },
    [open]
  );

  useEffect(() => {
    return () => {
      if (keepaliveTimer.current) clearTimeout(keepaliveTimer.current);
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, []);

  return { messages, status, connect, cheerLeaders, giftLeaders };
}
