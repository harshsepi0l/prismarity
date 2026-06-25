"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { ChatMessage, ConnectionStatus } from "./types";

// Kick has no official client-readable chat stream, so we read the same Pusher
// socket Kick's own web client uses. The app key + cluster are the public values
// the Kick frontend ships with. Unofficial — may change without notice.
const PUSHER_KEY = "32cbd69e4b950bf97679";
const PUSHER_URL = `wss://ws-us2.pusher.com/app/${PUSHER_KEY}?protocol=7&client=js&version=8.4.0&flash=false`;

interface UseKickChatReturn {
  messages: ChatMessage[];
  status: ConnectionStatus;
  connect: (chatroomId: number | null) => void;
}

// Kick message content embeds emotes as [emote:<id>:<name>]. Convert to the name
// (so it renders inline) and map name -> image URL for the shared emote renderer.
function parseKickEmotes(content: string): {
  text: string;
  nativeEmotes?: Record<string, string>;
} {
  const re = /\[emote:(\d+):([^\]]+)\]/g;
  const map: Record<string, string> = {};
  for (const m of content.matchAll(re)) {
    map[m[2]] = `https://files.kick.com/emotes/${m[1]}/fullsize`;
  }
  const text = content.replace(re, (_full, _id, name) => name);
  return { text, nativeEmotes: Object.keys(map).length ? map : undefined };
}

interface KickBadge {
  type?: string;
  count?: number;
}

interface KickChatEvent {
  id?: string;
  content?: string;
  created_at?: string;
  sender?: {
    id?: number;
    username?: string;
    identity?: { color?: string; badges?: KickBadge[] };
  };
}

export function useKickChat(): UseKickChatReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [status, setStatus] = useState<ConnectionStatus>("idle");
  const wsRef = useRef<WebSocket | null>(null);

  const connect = useCallback((chatroomId: number | null) => {
    if (wsRef.current) {
      wsRef.current.onclose = null;
      wsRef.current.close();
      wsRef.current = null;
    }
    setMessages([]);

    if (!chatroomId) {
      setStatus("idle");
      return;
    }
    setStatus("connecting");

    const ws = new WebSocket(PUSHER_URL);
    wsRef.current = ws;
    const channel = `chatrooms.${chatroomId}.v2`;

    ws.onmessage = (event: MessageEvent<string>) => {
      let frame: { event?: string; data?: unknown; channel?: string };
      try {
        frame = JSON.parse(event.data);
      } catch {
        return;
      }

      if (frame.event === "pusher:ping") {
        ws.send(JSON.stringify({ event: "pusher:pong", data: {} }));
        return;
      }
      if (frame.event === "pusher:connection_established") {
        ws.send(
          JSON.stringify({ event: "pusher:subscribe", data: { channel } })
        );
        return;
      }
      if (frame.event === "pusher_internal:subscription_succeeded") {
        setStatus("connected");
        return;
      }
      if (frame.event === "App\\Events\\ChatMessageEvent") {
        let payload: KickChatEvent;
        try {
          payload = typeof frame.data === "string" ? JSON.parse(frame.data) : (frame.data as KickChatEvent);
        } catch {
          return;
        }
        const { text, nativeEmotes } = parseKickEmotes(payload.content ?? "");
        const msg: ChatMessage = {
          id: payload.id || `kick-${Date.now()}-${Math.random()}`,
          platform: "kick",
          user: payload.sender?.username ?? "anon",
          userId: payload.sender?.id != null ? String(payload.sender.id) : undefined,
          text,
          color: payload.sender?.identity?.color || null,
          timestamp: payload.created_at ? Date.parse(payload.created_at) || Date.now() : Date.now(),
          nativeEmotes,
          badges:
            payload.sender?.identity?.badges?.map((b) => ({
              setId: b.type ?? "unknown",
              id: b.count != null ? String(b.count) : "1",
            })) ?? [],
        };
        setMessages((prev) => [...prev.slice(-199), msg]);
      }
    };

    ws.onerror = () => setStatus("error");
    ws.onclose = () => setStatus("idle");
  }, []);

  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, []);

  return { messages, status, connect };
}
