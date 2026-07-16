"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { ChatMessage, ConnectionStatus } from "../types";

const PUSHER_KEY = "32cbd69e4b950bf97679";
const PUSHER_WS = `wss://ws-us2.pusher.com/app/${PUSHER_KEY}?protocol=7&client=js&version=8.4.0-rc2&flash=false`;
const MAX_RETRIES = 6;

interface KickBadge { type?: string; count?: number }
interface KickChatPayload {
  id?: string;
  content?: string;
  created_at?: string;
  sender?: {
    id?: number;
    username?: string;
    identity?: { color?: string; badges?: KickBadge[] };
  };
}

function parseKickContent(raw: string): { text: string; nativeEmotes?: Record<string, string> } {
  const re = /\[emote:(\d+):([^\]]+)\]/g;
  const map: Record<string, string> = {};
  for (const m of raw.matchAll(re)) {
    map[m[2]] = `https://files.kick.com/emotes/${m[1]}/fullsize`;
  }
  return {
    text: raw.replace(re, (_f, _id, name: string) => name),
    nativeEmotes: Object.keys(map).length ? map : undefined,
  };
}

export function useKickChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [status, setStatus] = useState<ConnectionStatus>("idle");

  // Stable refs so callbacks can read/write without going stale.
  const wsRef = useRef<WebSocket | null>(null);
  const roomRef = useRef<number | null>(null);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryCountRef = useRef(0);

  const teardown = useCallback(() => {
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
    if (wsRef.current) {
      const ws = wsRef.current;
      wsRef.current = null;
      ws.onopen = null;
      ws.onmessage = null;
      ws.onerror = null;
      ws.onclose = null;
      ws.close();
    }
  }, []);

  // openWs is stored in a ref so the onclose retry can always call the current
  // version without forming a stale closure over an old callback identity.
  const openWsRef = useRef<(id: number) => void>(() => {});
  openWsRef.current = (chatroomId: number) => {
    if (wsRef.current) return;
    setStatus("connecting");

    const ws = new WebSocket(PUSHER_WS);
    wsRef.current = ws;
    const channel = `chatrooms.${chatroomId}.v2`;

    ws.onmessage = (ev: MessageEvent<string>) => {
      let frame: { event?: string; data?: unknown };
      try { frame = JSON.parse(ev.data); } catch { return; }

      switch (frame.event) {
        case "pusher:ping":
          ws.send(JSON.stringify({ event: "pusher:pong", data: {} }));
          break;

        case "pusher:connection_established":
          ws.send(JSON.stringify({ event: "pusher:subscribe", data: { channel } }));
          break;

        case "pusher_internal:subscription_succeeded":
          retryCountRef.current = 0;
          setStatus("connected");
          break;

        case "App\\Events\\ChatMessageEvent":
        case "App\\Events\\ChatMessageSent": {
          let payload: KickChatPayload;
          try {
            payload = typeof frame.data === "string"
              ? JSON.parse(frame.data)
              : (frame.data as KickChatPayload);
          } catch { return; }

          const { text, nativeEmotes } = parseKickContent(payload.content ?? "");
          const msg: ChatMessage = {
            id: payload.id || `kick-${Date.now()}-${Math.random()}`,
            platform: "kick",
            user: payload.sender?.username ?? "anon",
            userId: payload.sender?.id != null ? String(payload.sender.id) : undefined,
            text,
            color: payload.sender?.identity?.color ?? null,
            timestamp: payload.created_at
              ? (Date.parse(payload.created_at) || Date.now())
              : Date.now(),
            nativeEmotes,
            badges: (payload.sender?.identity?.badges ?? []).map((b) => ({
              setId: b.type ?? "unknown",
              id: b.count != null ? String(b.count) : "1",
            })),
          };
          setMessages((prev) => [...prev.slice(-199), msg]);
          break;
        }
      }
    };

    ws.onerror = () => { /* onclose always fires next; handle retry there */ };

    ws.onclose = () => {
      wsRef.current = null;
      // Bail if the user has already switched to a different channel.
      if (roomRef.current !== chatroomId) return;

      const attempt = ++retryCountRef.current;
      if (attempt > MAX_RETRIES) {
        setStatus("error");
        return;
      }

      // Exponential backoff: 1.5s → 3s → 6s → 12s → 24s → 30s
      const delay = Math.min(1500 * 2 ** (attempt - 1), 30_000);
      setStatus("connecting");
      retryTimerRef.current = setTimeout(() => {
        if (roomRef.current === chatroomId) openWsRef.current(chatroomId);
      }, delay);
    };
  };

  const connect = useCallback((chatroomId: number | null) => {
    teardown();
    roomRef.current = chatroomId;
    retryCountRef.current = 0;
    setMessages([]);

    if (!chatroomId) {
      setStatus("idle");
      return;
    }
    openWsRef.current(chatroomId);
  }, [teardown]);

  useEffect(() => () => teardown(), [teardown]);

  return { messages, status, connect } as const;
}
