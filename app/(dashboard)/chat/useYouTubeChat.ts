"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { ChatMessage, ConnectionStatus } from "../types";
import { nextSeq } from "./seq";

// YouTube live chat has no browser socket (Twitch = IRC, Kick = Pusher) — it's
// long-polled server-side. So this hook drives a cursor loop against our own
// /api/youtube/chat: each response carries the next cursor and the interval to
// wait, which we honour with a chained setTimeout (not a fixed interval).
//
// Two read modes, both behind that one route:
//   • own broadcast  → Data API (server resolves it via mine=true).
//   • tuned streamer → InnerTube by videoId (reads any public chat, no OAuth).
//
// Because it's polled, every response hands back the whole BATCH of messages
// since the last poll — dumping them at once reads as a burst every few seconds.
// So we don't append the batch directly: we queue it and drip it out across the
// poll interval (what YouTube's own player does), stamping `seq` at release time
// so each line appends at the feed bottom and interleaves naturally with the
// real-time Twitch/Kick feeds.

interface YouTubeChatApiMessage {
  id: string;
  user: string;
  userId: string | null;
  text: string;
  publishedAt: number;
  isOwner: boolean;
  isModerator: boolean;
  isMember: boolean;
  isVerified: boolean;
  nativeEmotes?: Record<string, string>;
}

interface YouTubeChatResponse {
  live?: boolean;
  messages?: YouTubeChatApiMessage[];
  cursor?: string | null;
  pollingIntervalMillis?: number;
}

// While enabled but not currently live, re-check this slowly so a stream that
// starts (or a chat that briefly errored) reconnects on its own.
const OFFLINE_RECHECK_MS = 10_000;

// Drip pacing bounds: fast enough that a big backlog doesn't lag far behind the
// live edge, slow enough that a lone message doesn't feel frozen for a full poll.
const DRIP_MIN_MS = 150;
const DRIP_MAX_MS = 900;

// What to read (both via InnerTube): the connected account's OWN broadcast (the
// server resolves its video id), or a tuned streamer's simulcast identified by
// its videoId. `liveChatId` rides along on the tuned target for the SEND path
// (the context reads it; the read poll ignores it) — null when YouTube isn't
// connected, which just makes that tuned chat read-only. null = don't poll.
export type YouTubeChatTarget =
  | { own: true }
  | { own: false; videoId: string; liveChatId: string | null };

export function useYouTubeChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [status, setStatus] = useState<ConnectionStatus>("idle");

  const enabledRef = useRef(false);
  // videoId for a tuned target; null means own (server resolves the video id).
  const videoIdRef = useRef<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Opaque InnerTube continuation cursor.
  const cursorRef = useRef<string | null>(null);
  // Ids already appended — the first poll returns backlog that can overlap a
  // later page, and cursor drift shouldn't surface a message twice.
  const seenRef = useRef<Set<string>>(new Set());

  // Drip queue: messages awaiting release (no seq yet), the release timer, and
  // the current per-message delay (recomputed each poll from queue depth).
  const queueRef = useRef<Omit<ChatMessage, "seq">[]>([]);
  const dripTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dripMsRef = useRef(DRIP_MAX_MS);

  const clearTimers = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (dripTimerRef.current) {
      clearTimeout(dripTimerRef.current);
      dripTimerRef.current = null;
    }
  }, []);

  // Release one queued message (stamped with a fresh seq so it lands at the feed
  // bottom in display order), then reschedule until the queue drains. Held in a
  // ref (like pollRef below) so the self-scheduling loop always has the current
  // version without a stale closure.
  const dripRef = useRef<() => void>(() => {});
  dripRef.current = () => {
    if (!enabledRef.current) {
      dripTimerRef.current = null;
      return;
    }
    const next = queueRef.current.shift();
    if (!next) {
      dripTimerRef.current = null;
      return;
    }
    setMessages((prev) => [...prev.slice(-199), { ...next, seq: nextSeq() }].slice(-200));
    dripTimerRef.current = setTimeout(() => dripRef.current(), dripMsRef.current);
  };

  // poll is held in a ref so the self-scheduling loop always calls the current
  // version and never closes over stale state.
  const pollRef = useRef<() => void>(() => {});
  pollRef.current = async () => {
    if (!enabledRef.current) return;
    const q = new URLSearchParams();
    if (videoIdRef.current) q.set("videoId", videoIdRef.current); // tuned
    else q.set("own", "1"); // own — server resolves the video id
    if (cursorRef.current) q.set("cursor", cursorRef.current);

    let schedule = OFFLINE_RECHECK_MS;
    try {
      const res = await fetch(`/api/youtube/chat?${q.toString()}`);
      if (!enabledRef.current) return;
      if (res.ok) {
        const data = (await res.json()) as YouTubeChatResponse;
        if (data.live) {
          cursorRef.current = data.cursor ?? cursorRef.current;
          schedule = data.pollingIntervalMillis ?? 5_000;
          setStatus("connected");

          for (const m of data.messages ?? []) {
            if (seenRef.current.has(m.id)) continue;
            seenRef.current.add(m.id);
            queueRef.current.push({
              id: m.id,
              platform: "youtube",
              user: m.user,
              userId: m.userId ?? undefined,
              text: m.text,
              color: null,
              timestamp: m.publishedAt,
              nativeEmotes: m.nativeEmotes,
            });
          }
          // Bound the dedupe set on very busy chats.
          if (seenRef.current.size > 1000) {
            seenRef.current = new Set([...seenRef.current].slice(-500));
          }
          // Pace the queue to empty roughly by the next poll, then kick the
          // drain loop if it isn't already running.
          if (queueRef.current.length) {
            dripMsRef.current = Math.min(
              DRIP_MAX_MS,
              Math.max(DRIP_MIN_MS, Math.floor(schedule / queueRef.current.length))
            );
            if (!dripTimerRef.current) dripTimerRef.current = setTimeout(() => dripRef.current(), dripMsRef.current);
          }
        } else {
          // Not broadcasting (or chat ended) — the continuation is void, so drop
          // it and keep re-checking. The next poll re-inits: own re-resolves the
          // video id, tuned re-scrapes the same videoId's chat, both server-side.
          cursorRef.current = null;
          setStatus("connecting");
        }
      }
    } catch {
      // Network error — keep the cursor and retry on the offline cadence.
      if (!enabledRef.current) return;
      setStatus("connecting");
    }

    if (enabledRef.current) {
      timerRef.current = setTimeout(() => pollRef.current(), schedule);
    }
  };

  // connect(target) starts (or restarts) the poll loop for that target;
  // connect(null) tears it down and clears the feed.
  const connect = useCallback(
    (target: YouTubeChatTarget | null) => {
      clearTimers();
      enabledRef.current = !!target;
      videoIdRef.current = target && !target.own ? target.videoId : null;
      cursorRef.current = null;
      seenRef.current = new Set();
      queueRef.current = [];
      setMessages([]);
      if (!target) {
        setStatus("idle");
        return;
      }
      setStatus("connecting");
      pollRef.current();
    },
    [clearTimers]
  );

  useEffect(
    () => () => {
      enabledRef.current = false;
      clearTimers();
    },
    [clearTimers]
  );

  return { messages, status, connect } as const;
}
