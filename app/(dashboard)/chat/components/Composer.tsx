"use client";

import { useMemo, useState } from "react";
import { Box, Flex, Input, Button, Text, chakra } from "@chakra-ui/react";
import { useChat } from "../../useChat";
import { useEmotes, useEmoteCategories } from "../../useEmotes";
import { useSession } from "../../useSession";
import { useStats } from "../../useStats";
import { PlatformIcon } from "../../components/PlatformIcon";
import type { Platform } from "../types";
import type { EmoteSource } from "@/app/api/emotes/route";

type EmoteTab = "all" | EmoteSource;

const TAB_LABEL: Record<EmoteTab, string> = {
  all: "All",
  "7tv": "7TV",
  bttv: "BTTV",
  ffz: "FFZ",
};

const ERROR_TEXT: Record<string, string> = {
  not_logged_in: "Log in to chat",
  unauthorized: "Re-login to grant chat permission",
  not_connected: "Platform not connected",
  bad_request: "Couldn't send that message",
  send_failed: "The platform rejected the message",
  no_channel: "Select a channel to chat",
  network: "Network error",
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

  // Live status per platform for the active selection — drives the offline-chat
  // indicators (both Twitch and Kick allow chatting in an offline channel, so we
  // surface the state rather than block the send).
  const liveByPlatform: Partial<Record<Platform, boolean>> = {};
  for (const p of platforms) liveByPlatform[p.platform] = p.isLive;

  // The name shown in placeholders/status — Twitch channel, else the Kick slug.
  const channelName = activeChannel?.displayName ?? activeKick?.slug ?? activeKickOnly ?? null;

  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [emoteQuery, setEmoteQuery] = useState("");
  const [activeTab, setActiveTab] = useState<EmoteTab>("all");
  const [dismissedShortcode, setDismissedShortcode] = useState<string | null>(null);

  // Inline ":partial" shortcode autocomplete — only live while there's no
  // space after the colon yet, i.e. you're still actively typing the code.
  const shortcodeQuery = text.match(/:(\w+)$/)?.[1]?.toLowerCase() ?? null;
  const shortcodeSuggestions = useMemo(() => {
    if (!shortcodeQuery || shortcodeQuery === dismissedShortcode || pickerOpen) return [];
    return Object.entries(emotes)
      .filter(([code]) => code.toLowerCase().startsWith(shortcodeQuery))
      .slice(0, 8);
  }, [emotes, shortcodeQuery, dismissedShortcode, pickerOpen]);

  function acceptShortcode(code: string) {
    setText((t) => t.replace(/:(\w+)$/, `${code} `));
    setDismissedShortcode(null);
  }

  function handleComposerKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (shortcodeSuggestions.length === 0) return;
    if (e.key === "Tab") {
      e.preventDefault();
      acceptShortcode(shortcodeSuggestions[0][0]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setDismissedShortcode(shortcodeQuery);
    }
  }

  // Only offer tabs for sources that actually have emotes for this channel.
  const availableTabs: EmoteTab[] = useMemo(
    () => ["all", ...categories.filter((c) => c.emotes.length > 0).map((c) => c.source)],
    [categories]
  );

  const filteredEmotes = useMemo(() => {
    const q = emoteQuery.trim().toLowerCase();
    const source: [string, string][] =
      activeTab === "all"
        ? Object.entries(emotes)
        : (categories.find((c) => c.source === activeTab)?.emotes ?? []).map(
            (e) => [e.code, e.url] as [string, string]
          );
    const matched = q ? source.filter(([code]) => code.toLowerCase().includes(q)) : source;
    return matched.slice(0, 200); // cap for performance
  }, [emotes, categories, activeTab, emoteQuery]);

  function insertEmote(code: string) {
    setText((t) => (t.trim() ? `${t.trimEnd()} ${code} ` : `${code} `));
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
        const res = await fetch("/api/twitch/chat/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ channelId: activeChannel.id, message }),
        });
        const j = (await res.json().catch(() => ({ ok: false }))) as { ok?: boolean; error?: string };
        return { ok: res.ok && !!j.ok, error: j.error };
      }
      if (platform === "kick") {
        if (!activeKick) return { ok: false, error: "no_channel" };
        const res = await fetch("/api/kick/chat/send", {
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const message = text.trim();
    if (!message || sending || deliverable.length === 0) return;

    setSending(true);
    setError(null);
    try {
      const results = await Promise.all(
        deliverable.map(async (t) => ({ platform: t, ...(await sendOne(t, message)) }))
      );
      const succeeded = results.filter((r) => r.ok).map((r) => r.platform);
      // One unified feed entry for everywhere it actually went.
      if (succeeded.length > 0) addSelfMessage(message, succeeded);

      const failed = results.find((r) => !r.ok);
      if (failed) {
        setError(friendly(failed.error));
      } else {
        setText("");
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
                filteredEmotes.map(([code, url]) => (
                  <chakra.button
                    key={code}
                    type="button"
                    onClick={() => insertEmote(code)}
                    title={code}
                    p="4px"
                    borderRadius="6px"
                    cursor="pointer"
                    transition="background .1s"
                    _hover={{ bg: "raised" }}
                  >
                    <chakra.img src={url} alt={code} h="26px" display="block" />
                  </chakra.button>
                ))
              )}
            </Flex>
          </Box>
        )}

        {shortcodeSuggestions.length > 0 && (
          <Flex
            position="absolute"
            bottom="100%"
            left="0"
            mb="8px"
            bg="panel"
            borderWidth="1px"
            borderColor="line"
            borderRadius="10px"
            p="6px"
            gap="4px"
            zIndex={5}
            maxW="100%"
            overflowX="auto"
          >
            {shortcodeSuggestions.map(([code, url]) => (
              <chakra.button
                key={code}
                type="button"
                onClick={() => acceptShortcode(code)}
                title={code}
                display="flex"
                flexDirection="column"
                alignItems="center"
                gap="2px"
                p="4px"
                borderRadius="6px"
                cursor="pointer"
                flex="none"
                _hover={{ bg: "raised" }}
              >
                <chakra.img src={url} alt={code} h="22px" display="block" />
                <Text fontSize="9px" color="faint" maxW="56px" truncate>
                  {code}
                </Text>
              </chakra.button>
            ))}
          </Flex>
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
          onSubmit={handleSubmit}
        >
          <Input
            flex="1"
            variant="flushed"
            border="none"
            px="0"
            fontSize="14px"
            color="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleComposerKeyDown}
            placeholder={
              channelName ? `Message ${channelName}…` : "Select a channel to chat"
            }
            _placeholder={{ color: "muted" }}
            _focusVisible={{ outline: "none", boxShadow: "none", borderColor: "transparent" }}
          />

          <chakra.button
            type="button"
            onClick={() => setPickerOpen((v) => !v)}
            title="Emotes"
            aria-label="Emotes"
            display="flex"
            alignItems="center"
            justifyContent="center"
            h="32px"
            w="32px"
            borderRadius="7px"
            color={pickerOpen ? "text" : "muted"}
            cursor="pointer"
            transition="background .12s, color .12s"
            _hover={{ bg: "raised", color: "text" }}
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

          <Button
            type="submit"
            flex="none"
            disabled={!canSend}
            bg="#4f4c4c"
            fontWeight="600"
            fontSize="14px"
            px="20px"
            py="9px"
            borderRadius="7px"
            _hover={{ bg: "#968f8f" }}
            _disabled={{ opacity: 0.5, cursor: "not-allowed" }}
          >
            {sending ? "…" : "Send"}
          </Button>
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
                  color={on && offline ? "#5C6479" : color}
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
                    bg="#5C6479"
                    borderWidth="1.5px"
                    borderColor="bg"
                    title="offline"
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

        <Text
          ml="auto"
          fontFamily="mono"
          fontSize="10px"
          letterSpacing="0.04em"
          color={error ? "#FF5C5C" : "faint"}
        >
          {error
            ? error
            : channelName
              ? `Chatting in ${channelName}`
              : "Select a channel to start chatting."}
        </Text>
      </Flex>
    </Box>
  );
}
