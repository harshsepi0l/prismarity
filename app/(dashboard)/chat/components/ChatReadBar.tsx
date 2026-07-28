"use client";

import { useEffect, useRef, useState } from "react";
import { Flex, Box, Text, chakra } from "@chakra-ui/react";
import type { Platform, UserSelection } from "../../types";
import {
  PlatformIcon,
  PLATFORM_COLOR,
  PLATFORM_LABEL,
} from "../../components/PlatformIcon";
import { useSession } from "../../_ctx/session";
import { alpha, accentLine } from "../../../theme-colors";
import ParticipantsButton from "./ParticipantsButton";

function Chevron({ open }: { open: boolean }) {
  return (
    <Box
      as="span"
      color="faint"
      display="inline-flex"
      transform={open ? "rotate(180deg)" : "none"}
      transition="transform .15s"
    >
      <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden>
        <path
          d="M1 3 L5 7 L9 3"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </Box>
  );
}

function CheckIcon({ color }: { color: string }) {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
      <path
        d="M2.5 6.2 L4.8 8.5 L9.5 3.5"
        stroke={color}
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// The read control for the chat pane: a "Watching" dropdown listing each platform
// available for the current channel, with a check per platform you're reading.
// Toggling a row shows/hides that platform's chat in the feed below. Independent
// of the composer's "Send to" targets. The right side hosts the participants
// roster. The Watching control shows whenever any chat is available — even a
// single stream — so you can always see what's currently being read.
export default function ChatReadBar({
  available,
  onSelectUser,
}: {
  available: Platform[];
  onSelectUser?: (selection: UserSelection) => void;
}) {
  const { activeFilters, toggleRead } = useSession();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // Close on outside click / Escape while open.
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node))
        setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (available.length === 0) return null;
  const multi = available.length >= 1;
  // Icons shown in the closed trigger — the platforms currently in the feed.
  const watching = available.filter((id) => activeFilters.has(id));

  return (
    <Flex
      flex="none"
      align="center"
      wrap="wrap"
      gap="8px"
      rowGap="6px"
      minW="0"
      px={{ base: "12px", md: "22px" }}
      py="7px"
      minH="38px"
      borderBottomWidth="1px"
      borderColor={accentLine}
    >
      {multi && (
        <Box position="relative" ref={rootRef} flex="none">
          <chakra.button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-label="Choose which chats to watch"
            title="Watching"
            display="inline-flex"
            alignItems="center"
            gap="8px"
            pl="11px"
            pr="9px"
            py="5px"
            borderRadius="full"
            borderWidth="1px"
            borderColor="fieldLine"
            bg={open ? "raised" : "field"}
            color={open ? "text" : "muted"}
            cursor="pointer"
            transition="background .12s, color .12s, border-color .12s"
            _hover={{ color: "text", borderColor: "lineStrong" }}
          >
            <Text
              fontFamily="mono"
              fontSize="10px"
              letterSpacing="0.08em"
              flex="none"
            >
              WATCHING
            </Text>
            {watching.length > 0 && (
              <Flex align="center" gap="4px" flex="none">
                {watching.map((id) => (
                  <PlatformIcon
                    key={id}
                    platform={id}
                    color={PLATFORM_COLOR[id]}
                    size={13}
                  />
                ))}
              </Flex>
            )}
            <Chevron open={open} />
          </chakra.button>

          {open && (
            <Box
              position="absolute"
              top="calc(100% + 8px)"
              left="0"
              w="220px"
              bg="panel"
              borderWidth="1px"
              borderColor="line"
              borderRadius="12px"
              overflow="hidden"
              zIndex={30}
              boxShadow="0 20px 50px rgba(0,0,0,0.6)"
            >
              <Text
                px="12px"
                pt="10px"
                pb="6px"
                fontFamily="mono"
                fontSize="9px"
                letterSpacing="0.12em"
                color="faint"
              >
                SHOW OR HIDE EACH CHAT
              </Text>
              <Box px="6px" pb="6px">
                {available.map((id) => {
                  const color = PLATFORM_COLOR[id];
                  const reading = activeFilters.has(id);
                  return (
                    <chakra.button
                      key={id}
                      type="button"
                      onClick={() => toggleRead(id)}
                      aria-pressed={reading}
                      display="flex"
                      alignItems="center"
                      gap="9px"
                      w="100%"
                      px="8px"
                      py="7px"
                      borderRadius="7px"
                      cursor="pointer"
                      opacity={reading ? 1 : 0.55}
                      transition="background .1s, opacity .12s"
                      _hover={{ bg: "raised", opacity: 1 }}
                    >
                      <PlatformIcon platform={id} color={color} size={14} />
                      <Text
                        fontSize="13px"
                        fontWeight="600"
                        color="text"
                        flex="1"
                        textAlign="left"
                      >
                        {PLATFORM_LABEL[id]}
                      </Text>
                      <Flex
                        align="center"
                        justify="center"
                        w="16px"
                        h="16px"
                        flex="none"
                        borderRadius="5px"
                        borderWidth="1px"
                        borderColor={reading ? alpha(color, 0.6) : "fieldLine"}
                        bg={reading ? alpha(color, 0.18) : "transparent"}
                      >
                        {reading && <CheckIcon color={color} />}
                      </Flex>
                    </chakra.button>
                  );
                })}
              </Box>
            </Box>
          )}
        </Box>
      )}

      <Box flex="1" />

      <ParticipantsButton available={available} onSelectUser={onSelectUser} />
    </Flex>
  );
}
