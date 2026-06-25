"use client";

import { useMemo, useState } from "react";
import { Box, Flex, Input, Button, Text, chakra } from "@chakra-ui/react";
import { useChat } from "../../useChat";
import { useEmotes } from "../../useEmotes";
import { useSession } from "../../useSession";
import { PlatformIcon } from "../../components/PlatformIcon";
import type { Platform } from "../types";

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
  const { sendTargets, toggleSendTarget } = useSession();

  // The name shown in placeholders/status — Twitch channel, else the Kick slug.
  const channelName = activeChannel?.displayName ?? activeKick?.slug ?? activeKickOnly ?? null;

  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [emoteQuery, setEmoteQuery] = useState("");

  const filteredEmotes = useMemo(() => {
    const q = emoteQuery.trim().toLowerCase();
    const all = Object.entries(emotes);
    const matched = q ? all.filter(([code]) => code.toLowerCase().includes(q)) : all;
    return matched.slice(0, 200); // cap for performance
  }, [emotes, emoteQuery]);

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
            const label = id === "twitch" ? "Twitch" : "Kick";
            return (
              <chakra.button
                key={id}
                type="button"
                onClick={() => toggleSendTarget(id)}
                title={`Send to ${label}${on ? "" : " (off)"}`}
                aria-pressed={on}
                display="inline-flex"
                cursor="pointer"
                opacity={on ? 1 : 0.3}
                transition="opacity .15s, filter .15s"
                style={{ filter: on ? `drop-shadow(0 0 5px ${color})` : "none" }}
                _hover={{ opacity: 1 }}
              >
                <PlatformIcon platform={id} color={color} size={17} />
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
              <PlatformIcon platform="twitch" color="#A66CFF" size={17} />
            </Box>
          )}
        </Flex>

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
