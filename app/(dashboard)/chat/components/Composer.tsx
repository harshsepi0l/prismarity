"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { RichInput, type RichInputHandle } from "./RichInput";
import { Box, Flex, Input, Text, chakra } from "@chakra-ui/react";
import { useChat } from "../../_ctx/chat";
import { useEmotes, useEmoteCategories } from "../../_ctx/emotes";
import { useSession } from "../../_ctx/session";
import { useStats } from "../../_ctx/stats";
import { PlatformIcon } from "../../components/PlatformIcon";
import type { Platform } from "../../types";
import type { EmoteSource } from "@/app/api/emotes/route";

type EmoteTab = "all" | EmoteSource;

const TAB_LABEL: Record<EmoteTab, string> = {
  all: "All",
  "7tv": "7TV",
  bttv: "BTTV",
  ffz: "FFZ",
  "twitch-channel": "Channel",
};

function LockBadge() {
  return (
    <Box
      position="absolute"
      bottom="2px"
      right="2px"
      borderRadius="3px"
      px="2px"
      py="1px"
      style={{ background: "rgba(0,0,0,0.65)", lineHeight: 0 }}
    >
      <svg width="8" height="8" viewBox="0 0 24 24" fill="white" aria-hidden>
        <path d="M18 10h-1V7c0-2.76-2.24-5-5-5S7 4.24 7 7v3H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V12c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V7c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v3z" />
      </svg>
    </Box>
  );
}

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

function friendly(error?: string): string {
  if (!error) return "Couldn't send";
  return ERROR_TEXT[error] ?? error;
}

export default function Composer() {
  const { activeChannel, activeKick, activeKickOnly, addSelfMessage } = useChat();
  const emotes = useEmotes();
  const categories = useEmoteCategories();
  const { sendTargets, toggleSendTarget } = useSession();
  const { platforms } = useStats();

  // Live status per platform for the active selection.
  const liveByPlatform: Partial<Record<Platform, boolean>> = {};
  for (const p of platforms) liveByPlatform[p.platform] = p.isLive;

  // The name shown in placeholders/status — Twitch channel, else the Kick slug.
  const channelName = activeChannel?.displayName ?? activeKick?.slug ?? activeKickOnly ?? null;

  const richInputRef = useRef<RichInputHandle>(null);
  const [text, setText] = useState("");
  const [textBeforeCursor, setTextBeforeCursor] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorPlatform, setErrorPlatform] = useState<"twitch" | "kick" | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  // Clear input whenever the active channel changes or is removed.
  const selectionKey = activeChannel?.id ?? activeKick?.slug ?? activeKickOnly ?? null;
  useEffect(() => {
    richInputRef.current?.clear();
    setError(null);
    setErrorPlatform(null);
    setPickerOpen(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectionKey]);

  // Both platforms are reactive-only: a failed send is the only reliable signal
  // that the user isn't following. No proactive API checks, no proactive banners.
  // After clicking Follow we show a countdown so they know when to try again.
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

  const twitchFollowerMinutes =
    platforms.find((p) => p.platform === "twitch")?.chatMode?.followerMinutes ?? 0;
  const kickFollowerMinutes =
    platforms.find((p) => p.platform === "kick")?.chatMode?.followerMinutes ?? 0;

  // Reactive follow link — shown only after a failed send proves the user isn't following.
  const isFollowerError = error === ERROR_TEXT.follower_only;
  const reactiveFollowLink = isFollowerError
    ? errorPlatform === "twitch"
      ? `https://twitch.tv/${activeChannel?.login ?? ""}`
      : errorPlatform === "kick"
        ? `https://kick.com/${activeKick?.slug ?? ""}`
        : null
    : null;
  const [emoteQuery, setEmoteQuery] = useState("");
  const [activeTab, setActiveTab] = useState<EmoteTab>("all");
  const [dismissedShortcode, setDismissedShortcode] = useState<string | null>(null);
  const [selectedSuggIdx, setSelectedSuggIdx] = useState(0);

  // Detect ":word" immediately before the caret (not end of full text, since
  // the caret might not be at the end with a rich input).
  const shortcodeQuery = textBeforeCursor.match(/:(\w+)$/)?.[1]?.toLowerCase() ?? null;
  const shortcodeSuggestions = useMemo(() => {
    if (!shortcodeQuery || shortcodeQuery === dismissedShortcode || pickerOpen) return [];
    return Object.entries(emotes)
      .filter(([code]) => code.toLowerCase().startsWith(shortcodeQuery))
      .slice(0, 8);
  }, [emotes, shortcodeQuery, dismissedShortcode, pickerOpen]);

  // Reset selection index whenever the query changes (new character typed).
  useEffect(() => {
    setSelectedSuggIdx(0);
  }, [shortcodeQuery]);

  function acceptShortcode(code: string, url: string) {
    richInputRef.current?.acceptShortcode(code, url);
    setDismissedShortcode(null);
  }

  function handleComposerKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (shortcodeSuggestions.length === 0) return;
    if (e.key === "ArrowRight") {
      e.preventDefault();
      setSelectedSuggIdx((i) => (i + 1) % shortcodeSuggestions.length);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      setSelectedSuggIdx((i) => (i - 1 + shortcodeSuggestions.length) % shortcodeSuggestions.length);
    } else if (e.key === "Tab" || e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      const [code, url] = shortcodeSuggestions[selectedSuggIdx];
      acceptShortcode(code, url);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setDismissedShortcode(shortcodeQuery);
    }
  }

  // Twitch emotes (7TV/BTTV/FFZ/channel) are only relevant when Twitch is a send target.
  // If only Kick is targeted, we have no Kick-specific emotes to offer.
  const showTwitchEmotes = sendTargets.has("twitch");

  // Only offer tabs for sources that actually have emotes for this channel.
  const availableTabs: EmoteTab[] = useMemo(
    () =>
      showTwitchEmotes
        ? ["all", ...categories.filter((c) => c.emotes.length > 0).map((c) => c.source)]
        : [],
    [categories, showTwitchEmotes]
  );

  type EmoteEntry = { code: string; url: string; locked?: boolean };
  const filteredEmotes = useMemo((): EmoteEntry[] => {
    if (!showTwitchEmotes) return [];
    const q = emoteQuery.trim().toLowerCase();
    const source: EmoteEntry[] =
      activeTab === "all"
        ? categories.flatMap((c) => c.emotes)
        : (categories.find((c) => c.source === activeTab)?.emotes ?? []);
    const matched = q ? source.filter((e) => e.code.toLowerCase().includes(q)) : source;
    return matched.slice(0, 200);
  }, [categories, activeTab, emoteQuery, showTwitchEmotes]);

  function insertEmote(code: string, url: string, locked?: boolean) {
    if (locked) return;
    richInputRef.current?.insertEmote(code, url);
  }

  // The platforms you can actually send to for the active selection: Twitch when
  // a channel is selected, Kick when one is linked. Independent of role — the
  // channel you're viewing now spans both environments.
  const SEND_PLATFORMS: { id: Platform; color: string }[] = [
    { id: "twitch", color: "#A66CFF" },
    { id: "kick", color: "#5BE37D" },
  ];
  const available: Platform[] = [];
  if (activeChannel) available.push("twitch");
  if (activeKick) available.push("kick");
  // Glow toggles pick among the available platforms; default is all-on.
  const deliverable = available.filter((p) => sendTargets.has(p));
  // Armed targets whose channel is currently offline — the message would land in
  // that platform's offline chat.
  const offlineTargets = deliverable.filter((p) => liveByPlatform[p] === false);
  const PLATFORM_LABELS: Record<Platform, string> = {
    twitch: "Twitch",
    youtube: "YouTube",
    kick: "Kick",
  };

  async function sendOne(
    platform: Platform,
    message: string
  ): Promise<{ ok: boolean; error?: string }> {
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
      return { ok: false, error: "not_connected" }; // YouTube not yet supported
    } catch {
      return { ok: false, error: "network" };
    }
  }

  async function doSend() {
    const message = text.trim();
    if (!message || sending || deliverable.length === 0) return;

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
          failed.platform === "twitch" || failed.platform === "kick" ? failed.platform : null
        );
      } else {
        richInputRef.current?.clear();
        setPickerOpen(false);
      }
    } finally {
      setSending(false);
    }
  }

  const canSend = deliverable.length > 0 && !!text.trim() && !sending;

  return (
    <Box flex="none" px="24px" pt="16px" pb="22px">
      <Box position="relative">
        {pickerOpen && (
          <Box
            position="absolute"
            bottom="100%"
            left="0"
            right="0"
            mb="8px"
            maxH="280px"
            bg="panel"
            borderWidth="1px"
            borderColor="line"
            borderRadius="10px"
            overflow="hidden"
            display="flex"
            flexDirection="column"
            zIndex={5}
          >
            <Box p="8px" borderBottomWidth="1px" borderColor="line">
              <Input
                value={emoteQuery}
                onChange={(e) => setEmoteQuery(e.target.value)}
                placeholder="Search emotes…"
                h="30px"
                fontSize="12px"
                bg="field"
                borderColor="fieldLine"
                borderRadius="8px"
                color="text"
                _placeholder={{ color: "faint" }}
                _focusVisible={{ borderColor: "muted", boxShadow: "none" }}
              />
            </Box>

            {availableTabs.length > 1 && (
              <Flex px="8px" py="6px" gap="4px" borderBottomWidth="1px" borderColor="line">
                {availableTabs.map((tab) => (
                  <chakra.button
                    key={tab}
                    type="button"
                    onClick={() => setActiveTab(tab)}
                    px="8px"
                    py="3px"
                    borderRadius="6px"
                    fontSize="11px"
                    fontWeight="600"
                    bg={activeTab === tab ? "raised" : "transparent"}
                    color={activeTab === tab ? "text" : "faint"}
                    cursor="pointer"
                    transition="background .12s, color .12s"
                    _hover={{ color: "text" }}
                  >
                    {TAB_LABEL[tab]}
                  </chakra.button>
                ))}
              </Flex>
            )}

            <Flex p="8px" gap="2px" wrap="wrap" overflowY="auto" alignContent="flex-start">
              {filteredEmotes.length === 0 ? (
                <Text fontSize="12px" color="faint" p="8px">
                  No emotes
                </Text>
              ) : (
                filteredEmotes.map(({ code, url, locked }) => (
                  <chakra.button
                    key={code}
                    type="button"
                    onClick={() => insertEmote(code, url, locked)}
                    title={locked ? `${code} (Subscribers only — cannot send)` : code}
                    p="4px"
                    borderRadius="6px"
                    cursor={locked ? "not-allowed" : "pointer"}
                    opacity={locked ? 0.45 : 1}
                    transition="background .1s, opacity .1s"
                    _hover={{ bg: locked ? "transparent" : "raised" }}
                    position="relative"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt={code} style={{ display: "block", height: 26 }} />
                    {locked && <LockBadge />}
                  </chakra.button>
                ))
              )}
            </Flex>
          </Box>
        )}

        {shortcodeSuggestions.length > 0 && (
          <Box
            position="absolute"
            bottom="100%"
            left="0"
            mb="8px"
            bg="panel"
            borderWidth="1px"
            borderColor="line"
            borderRadius="10px"
            zIndex={5}
            maxW="100%"
            overflow="hidden"
          >
            <Flex px="8px" pt="5px" pb="1px" justify="space-between" align="center">
              <Text fontSize="9px" fontFamily="mono" letterSpacing="0.1em" color="faint">
                EMOTES
              </Text>
              <Text fontSize="9px" color="faint">
                ←→ navigate · Enter insert · Esc close
              </Text>
            </Flex>
            <Flex p="6px" gap="4px" overflowX="auto">
            {shortcodeSuggestions.map(([code, url], idx) => {
              const selected = idx === selectedSuggIdx;
              return (
                <chakra.button
                  key={code}
                  type="button"
                  onClick={() => acceptShortcode(code, url)}
                  title={code}
                  display="flex"
                  flexDirection="column"
                  alignItems="center"
                  gap="2px"
                  p="4px"
                  borderRadius="6px"
                  cursor="pointer"
                  flex="none"
                  bg={selected ? "raised" : "transparent"}
                  outline={selected ? "1px solid" : "none"}
                  outlineColor={selected ? "#A66CFF66" : "transparent"}
                  transition="background .1s"
                  _hover={{ bg: "raised" }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt={code} style={{ display: "block", height: 22 }} />
                  <Text fontSize="9px" color={selected ? "text" : "faint"} maxW="56px" truncate>
                    {code}
                  </Text>
                </chakra.button>
              );
            })}
            </Flex>
          </Box>
        )}

        <Flex
          as="form"
          align="center"
          gap="10px"
          bg="field"
          borderWidth="1px"
          borderColor="fieldLine"
          borderRadius="10px"
          pl="16px"
          pr="6px"
          py="6px"
          onSubmit={(e) => { e.preventDefault(); void doSend(); }}
        >
          <RichInput
            ref={richInputRef}
            emotes={emotes}
            placeholder={channelName ? `Message ${channelName}…` : "Select a channel to chat"}
            disabled={sending}
            onChange={setText}
            onBeforeCursor={setTextBeforeCursor}
            onKeyDown={handleComposerKeyDown}
            onSubmit={() => { void doSend(); }}
          />

          <chakra.button
            type="button"
            onClick={() => showTwitchEmotes && setPickerOpen((v) => !v)}
            title={showTwitchEmotes ? "Emotes" : "Emotes (select Twitch to use)"}
            aria-label="Emotes"
            display="flex"
            alignItems="center"
            justifyContent="center"
            h="32px"
            w="32px"
            borderRadius="7px"
            color={pickerOpen ? "text" : "muted"}
            cursor={showTwitchEmotes ? "pointer" : "not-allowed"}
            opacity={showTwitchEmotes ? 1 : 0.35}
            transition="background .12s, color .12s, opacity .12s"
            _hover={{ bg: showTwitchEmotes ? "raised" : "transparent", color: showTwitchEmotes ? "text" : "muted" }}
          >
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden>
              <circle cx="10" cy="10" r="7.5" stroke="currentColor" strokeWidth="1.5" />
              <circle cx="7.3" cy="8.3" r="1" fill="currentColor" />
              <circle cx="12.7" cy="8.3" r="1" fill="currentColor" />
              <path
                d="M6.8 12 C8 13.6 12 13.6 13.2 12"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </chakra.button>

          <chakra.button
            type="submit"
            flex="none"
            disabled={!canSend}
            suppressHydrationWarning
            bg="#4f4c4c"
            fontWeight="600"
            fontSize="14px"
            px="20px"
            py="9px"
            borderRadius="7px"
            color="white"
            cursor={canSend ? "pointer" : "not-allowed"}
            opacity={canSend ? 1 : 0.5}
            transition="background .12s, opacity .12s"
            _hover={{ bg: canSend ? "#968f8f" : "#4f4c4c" }}
          >
            {sending ? "…" : "Send"}
          </chakra.button>
        </Flex>
      </Box>
      <Flex mt="10px" align="center" gap="12px">

        
        <Flex align="center" gap="9px">
          {/* Send-target glow toggles, one per available platform. Toggling Kick
              glows it and routes your message there too. */}
          {SEND_PLATFORMS.filter(({ id }) => available.includes(id)).map(({ id, color }) => {
            const on = sendTargets.has(id);
            const label = PLATFORM_LABELS[id];
            const offline = liveByPlatform[id] === false;
            // Three states: off (dim), on+offline (grey, no glow, offline dot),
            // on+live (colored glow).
            const title = !on
              ? `Send to ${label} (off)`
              : offline
                ? `${label} is offline — message posts to its offline chat`
                : `Send to ${label}`;
            return (
              <chakra.button
                key={id}
                type="button"
                onClick={() => toggleSendTarget(id)}
                title={title}
                aria-pressed={on}
                position="relative"
                display="inline-flex"
                cursor="pointer"
                opacity={on ? 1 : 0.3}
                transition="opacity .15s, filter .15s"
                style={{
                  filter: on && !offline ? `drop-shadow(0 0 5px ${color})` : "none",
                }}
                _hover={{ opacity: 1 }}
              >
                <PlatformIcon
                  platform={id}
                  color={color}
                  size={17}
                />
                {on && offline && (
                  <Box
                    position="absolute"
                    top="-3px"
                    right="-3px"
                    w="7px"
                    h="7px"
                    borderRadius="full"
                    bg="#F5A623"
                    borderWidth="1.5px"
                    borderColor="bg"
                    title="offline"
                    style={{ animation: "pris-pulse 1.2s ease-in-out infinite" }}
                  />
                )}
              </chakra.button>
            );
          })}
          {available.length === 0 && (
            <Box
              as="span"
              display="inline-flex"
              title="Select a channel to chat"
              opacity={0.3}
            >
              
              <PlatformIcon platform="twitch" color="#A66CFF" size={14}/>
              <PlatformIcon platform="kick" color="#5BE37D" size={14} />
            </Box>
            
          )}
        </Flex>
        {offlineTargets.length > 0 ? (
          <Flex align="center" gap="6px" title="Both Twitch and Kick allow chatting while a channel is offline.">
            <Box w="6px" h="6px" borderRadius="full" bg="#F5A623" flex="none" />
            <Text fontFamily="mono" fontSize="10px" letterSpacing="0.04em" color="#F5A623">
              {`Posting to offline chat on ${offlineTargets
                .map((p) => PLATFORM_LABELS[p])
                .join(" & ")}`}
            </Text>
          </Flex>
        ) : (
          <Text fontFamily="mono" fontSize="10px" letterSpacing="0.04em" color="faint">
            {"You can read or send chats based on the platform(s) you select at the top!"}
          </Text>
        )}

        {error ? (
          <Flex align="center" gap="8px" ml="auto">
            <Text
              fontFamily="mono"
              fontSize="10px"
              letterSpacing="0.04em"
              color="#FF5C5C"
            >
              {error}
            </Text>
            {reactiveFollowLink && (
              <chakra.a
                href={reactiveFollowLink}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => {
                  const mins = errorPlatform === "twitch" ? twitchFollowerMinutes : kickFollowerMinutes;
                  startFollowCountdown(Math.max(15, mins > 0 ? mins * 60 : errorPlatform === "twitch" ? 60 : 15));
                }}
                px="8px"
                py="2px"
                borderRadius="5px"
                fontSize="10px"
                fontWeight="600"
                bg={errorPlatform === "twitch" ? "#A66CFF22" : "#5BE37D22"}
                color={errorPlatform === "twitch" ? "twitch" : "kick"}
                borderWidth="1px"
                borderColor={errorPlatform === "twitch" ? "#A66CFF44" : "#5BE37D44"}
                flex="none"
                transition="background .12s"
                _hover={{ bg: errorPlatform === "twitch" ? "#A66CFF33" : "#5BE37D33" }}
              >
                Follow
              </chakra.a>
            )}
          </Flex>
        ) : (
          <Text
            ml="auto"
            fontFamily="mono"
            fontSize="10px"
            letterSpacing="0.04em"
            color="faint"
          >
            {channelName ? `Chatting in ${channelName}` : "Select a channel to start chatting."}
          </Text>
        )}
      </Flex>

      {/* Follow countdown — shown after clicking Follow from a reactive error */}
      {followCountdown !== null && (
        <Flex
          align="center"
          gap="8px"
          mt="8px"
          px="12px"
          py="7px"
          borderRadius="8px"
          bg={errorPlatform === "twitch" ? "#1a1f2e" : "#0f2318"}
          borderWidth="1px"
          borderColor={errorPlatform === "twitch" ? "#A66CFF44" : "#5BE37D44"}
        >
          <Box
            w="6px" h="6px" flex="none" borderRadius="full"
            bg={errorPlatform === "twitch" ? "twitch" : "kick"}
            style={{ animation: "pris-pulse 1s ease-in-out infinite" }}
          />
          <Text fontSize="12px" color="muted" flex="1">
            {"Follow registered — try sending again in "}
            <Text as="span" color={errorPlatform === "twitch" ? "twitch" : "kick"} fontWeight="600">
              {followCountdown}s
            </Text>
          </Text>
        </Flex>
      )}
    </Box>
  );
}
