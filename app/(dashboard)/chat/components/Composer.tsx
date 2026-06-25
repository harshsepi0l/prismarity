"use client";

import { useMemo, useState } from "react";
import { Box, Flex, Input, Button, Text, chakra } from "@chakra-ui/react";
import { useChat } from "../../useChat";
import { useEmotes } from "../../useEmotes";
import { useSession } from "../../useSession";
import { PlatformIcon } from "../../components/PlatformIcon";
import type { Platform } from "../types";

const PLATFORMS: { id: Platform; label: string; color: string }[] = [
  { id: "twitch", label: "Twitch", color: "#A66CFF" },
  { id: "youtube", label: "YouTube", color: "#FF5C5C" },
  { id: "kick", label: "Kick", color: "#5BE37D" },
];

const ERROR_TEXT: Record<string, string> = {
  not_logged_in: "Log in with Twitch to chat",
  unauthorized: "Re-login to grant chat permission",
  not_connected: "No Twitch account connected",
  bad_request: "Couldn't send that message",
  send_failed: "Twitch rejected the message",
};

function friendly(error?: string): string {
  if (!error) return "Couldn't send";
  return ERROR_TEXT[error] ?? error;
}

export default function Composer() {
  const { activeChannel } = useChat();
  const emotes = useEmotes();
  const { mode, sendTargets, toggleSendTarget } = useSession();

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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const message = text.trim();
    if (!message || !activeChannel || sending) return;

    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/twitch/chat/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channelId: activeChannel.id, message }),
      });
      const json = (await res.json().catch(() => ({ ok: false }))) as {
        ok?: boolean;
        error?: string;
      };
      if (res.ok && json.ok) {
        setText("");
        setPickerOpen(false);
      } else {
        setError(friendly(json.error));
      }
    } catch {
      setError("Network error");
    } finally {
      setSending(false);
    }
  }

  // Delivery currently only reaches Twitch (the active channel). Creator can
  // deselect Twitch as a send target; other modes always target the channel.
  const sendsToTwitch = mode !== "creator" || sendTargets.has("twitch");
  const canSend = !!activeChannel && sendsToTwitch && !!text.trim() && !sending;

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
              activeChannel
                ? `Message ${activeChannel.displayName}…`
                : "Select a channel to chat"
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
          {mode === "creator" ? (
            // Creator: independent send-target toggles (which platforms to post to).
            PLATFORMS.map(({ id, label, color }) => {
              const on = sendTargets.has(id);
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
            })
          ) : (
            // Moderator / Viewer: you chat in the channel you're viewing.
            <Box
              as="span"
              display="inline-flex"
              title="You chat in the channel you're viewing"
              opacity={activeChannel ? 1 : 0.3}
              style={{ filter: activeChannel ? "drop-shadow(0 0 5px #A66CFF)" : "none" }}
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
            : activeChannel
              ? `Chatting in ${activeChannel.displayName}`
              : "Select a followed channel to start chatting."}
        </Text>
      </Flex>
    </Box>
  );
}
