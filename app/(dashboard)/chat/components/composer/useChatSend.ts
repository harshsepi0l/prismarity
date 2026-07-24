"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useChat } from "../../../_ctx/chat";
import type { Platform } from "../../../types";

const ERROR_TEXT: Record<string, string> = {
  not_logged_in: "Log in to chat",
  unauthorized: "Re-login to grant chat permission",
  not_connected: "Platform not connected",
  bad_request: "Couldn't send that message",
  send_failed: "The platform rejected the message",
  no_channel: "Select a channel to chat",
  network: "Network error",
  follower_only: "Follower-only chat — follow to send messages",
  sub_only: "Subscriber-only chat",
  slow_mode: "Slow mode — wait a moment before sending again",
  timed_out: "You're timed out in this chat",
  banned: "You're banned from this chat",
};

// The message shown when a send fails with follower-only mode — used by the
// composer to decide whether to surface a reactive Follow link.
export const FOLLOWER_ONLY_MESSAGE = ERROR_TEXT.follower_only;

function friendly(error?: string): string {
  if (!error) return "Couldn't send";
  return ERROR_TEXT[error] ?? error;
}

export interface ChatSend {
  sending: boolean;
  error: string | null;
  errorPlatform: "twitch" | "kick" | "youtube" | null;
  followCountdown: number | null;
  startFollowCountdown: (seconds: number) => void;
  // Delivers `message` to every platform in `deliverable`, adding the optimistic
  // self-message first. Resolves true on full success, false if any send failed
  // (in which case `error`/`errorPlatform` are set).
  send: (message: string, deliverable: Platform[]) => Promise<boolean>;
  clearError: () => void;
}

// All the outgoing-message state and orchestration, pulled out of Composer:
// per-platform delivery, error mapping, and the post-follow retry countdown.
export function useChatSend(): ChatSend {
  const { activeChannel, activeKick, activeYouTube, addSelfMessage } = useChat();

  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorPlatform, setErrorPlatform] = useState<"twitch" | "kick" | "youtube" | null>(null);
  const [followCountdown, setFollowCountdown] = useState<number | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startFollowCountdown = useCallback((seconds: number) => {
    if (countdownRef.current) clearInterval(countdownRef.current);
    setFollowCountdown(seconds);
    countdownRef.current = setInterval(() => {
      setFollowCountdown((n) => {
        if (n == null || n <= 1) {
          if (countdownRef.current) clearInterval(countdownRef.current);
          countdownRef.current = null;
          return null;
        }
        return n - 1;
      });
    }, 1000);
  }, []);

  useEffect(() => () => { if (countdownRef.current) clearInterval(countdownRef.current); }, []);

  const sendOne = useCallback(
    async (platform: Platform, message: string): Promise<{ ok: boolean; error?: string }> => {
      try {
        if (platform === "twitch") {
          if (!activeChannel) return { ok: false, error: "no_channel" };
          const res = await fetch("/api/twitch/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ channelId: activeChannel.id, message }),
          });
          const j = (await res.json().catch(() => ({ ok: false }))) as { ok?: boolean; error?: string };
          return { ok: res.ok && !!j.ok, error: j.error };
        }
        if (platform === "kick") {
          if (!activeKick) return { ok: false, error: "no_channel" };
          const res = await fetch("/api/kick/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ slug: activeKick.slug, message }),
          });
          const j = (await res.json().catch(() => ({ ok: false }))) as { ok?: boolean; error?: string };
          return { ok: res.ok && !!j.ok, error: j.error };
        }
        if (platform === "youtube") {
          if (!activeYouTube) return { ok: false, error: "no_channel" };
          // Own broadcast: omit liveChatId, the route resolves it via mine=true.
          // Tuned streamer: post to the resolved liveChatId (needs YT connected).
          if (!activeYouTube.own && !activeYouTube.liveChatId) return { ok: false, error: "no_channel" };
          const res = await fetch("/api/youtube/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              liveChatId: activeYouTube.own ? undefined : activeYouTube.liveChatId,
              message,
            }),
          });
          const j = (await res.json().catch(() => ({ ok: false }))) as { ok?: boolean; error?: string };
          return { ok: res.ok && !!j.ok, error: j.error };
        }
        return { ok: false, error: "not_connected" };
      } catch {
        return { ok: false, error: "network" };
      }
    },
    [activeChannel, activeKick, activeYouTube]
  );

  const send = useCallback(
    async (message: string, deliverable: Platform[]): Promise<boolean> => {
      setSending(true);
      setError(null);
      setErrorPlatform(null);
      addSelfMessage(message, deliverable);
      try {
        const results = await Promise.all(
          deliverable.map(async (t) => ({ platform: t, ...(await sendOne(t, message)) }))
        );
        const failed = results.find((r) => !r.ok);
        if (failed) {
          setError(friendly(failed.error));
          setErrorPlatform(
            failed.platform === "twitch" || failed.platform === "kick" || failed.platform === "youtube"
              ? failed.platform
              : null
          );
          return false;
        }
        return true;
      } finally {
        setSending(false);
      }
    },
    [addSelfMessage, sendOne]
  );

  const clearError = useCallback(() => {
    setError(null);
    setErrorPlatform(null);
  }, []);

  return { sending, error, errorPlatform, followCountdown, startFollowCountdown, send, clearError };
}
