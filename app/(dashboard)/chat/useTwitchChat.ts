"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { ChatMessage, ConnectionStatus } from "./types";

interface UseTwitchChatReturn {
  messages: ChatMessage[];
  status: ConnectionStatus;
  connect: (channel: string) => void;
}

function parseTags(tagStr: string): Record<string, string> {
  const tags: Record<string, string> = {};
  for (const part of tagStr.split(";")) {
    const eqIdx = part.indexOf("=");
    if (eqIdx === -1) continue;
    tags[part.slice(0, eqIdx)] = part.slice(eqIdx + 1);
  }
  return tags;
}

// Parse the IRC `emotes` tag into a code -> Twitch CDN URL map. The tag looks
// like "25:0-4,12-16/1902:6-10": emoteId:range,range/emoteId:range. Ranges are
// code-point indices into the message text, so we read the code from there.
function parseNativeEmotes(
  emotesTag: string,
  text: string
): Record<string, string> | undefined {
  if (!emotesTag) return undefined;
  const chars = [...text]; // code points (handles surrogate pairs)
  const map: Record<string, string> = {};
  for (const group of emotesTag.split("/")) {
    const [id, ranges] = group.split(":");
    if (!id || !ranges) continue;
    const first = ranges.split(",")[0];
    const [startStr, endStr] = first.split("-");
    const start = Number(startStr);
    const end = Number(endStr);
    if (Number.isNaN(start) || Number.isNaN(end)) continue;
    const code = chars.slice(start, end + 1).join("");
    if (code) {
      map[code] = `https://static-cdn.jtvnw.net/emoticons/v2/${id}/default/dark/2.0`;
    }
  }
  return Object.keys(map).length ? map : undefined;
}

function parsePrivmsg(line: string): ChatMessage | null {
  let tagStr = "";
  let rest = line;

  if (line.startsWith("@")) {
    const spaceIdx = line.indexOf(" ");
    tagStr = line.slice(1, spaceIdx);
    rest = line.slice(spaceIdx + 1);
  }

  const match = rest.match(/^:(\S+)!\S+ PRIVMSG #\S+ :(.+)$/);
  if (!match) return null;

  const tags = tagStr ? parseTags(tagStr) : {};
  const text = match[2];
  const displayName = tags["display-name"] || match[1];
  const color = tags["color"] || null;

  return {
    id: tags["id"] || `${Date.now()}-${Math.random()}`,
    platform: "twitch",
    user: displayName,
    text,
    color,
    timestamp: Date.now(),
    nativeEmotes: parseNativeEmotes(tags["emotes"] ?? "", text),
  };
}

export function useTwitchChat(): UseTwitchChatReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [status, setStatus] = useState<ConnectionStatus>("idle");
  const wsRef = useRef<WebSocket | null>(null);

  const connect = useCallback((channel: string) => {
    if (wsRef.current) {
      wsRef.current.onclose = null;
      wsRef.current.close();
      wsRef.current = null;
    }

    const ch = channel.toLowerCase().replace(/^#/, "");
    setMessages([]);
    setStatus("connecting");

    const ws = new WebSocket("wss://irc-ws.chat.twitch.tv:443");
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send("CAP REQ :twitch.tv/tags twitch.tv/commands");
      ws.send(`NICK justinfan${Math.floor(Math.random() * 99999)}`);
      ws.send(`JOIN #${ch}`);
    };

    ws.onmessage = (event: MessageEvent<string>) => {
      const lines = event.data.split("\r\n").filter(Boolean);
      for (const line of lines) {
        if (line.startsWith("PING")) {
          ws.send("PONG :tmi.twitch.tv");
          continue;
        }
        if (line.includes(` JOIN #${ch}`)) {
          setStatus("connected");
        }
        if (line.includes("PRIVMSG")) {
          const msg = parsePrivmsg(line);
          if (msg) setMessages((prev) => [...prev.slice(-199), msg]);
        }
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
