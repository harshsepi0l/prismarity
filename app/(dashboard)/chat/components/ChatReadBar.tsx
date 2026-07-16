"use client";

import { Flex, Text, chakra } from "@chakra-ui/react";
import type { Platform } from "../../types";
import { PlatformIcon, PLATFORM_COLOR, PLATFORM_LABEL } from "../../components/PlatformIcon";
import { useSession } from "../../_ctx/session";

// Tiny eye — open = watching this chat, slashed = hidden.
function EyeIcon({ open }: { open: boolean }) {
  return (
    <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden>
      <path d="M1 6 C2.5 3.2, 9.5 3.2, 11 6 C9.5 8.8, 2.5 8.8, 1 6 Z" stroke="currentColor" strokeWidth="1" />
      <circle cx="6" cy="6" r="1.4" fill="currentColor" />
      {!open && <line x1="2" y1="10" x2="10" y2="2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />}
    </svg>
  );
}

// The read control for the chat pane: one eye-pill per platform available for the
// current channel. Click to show/hide that platform's chat in the feed below.
// Independent of the composer's "Send to" targets.
export default function ChatReadBar({ available }: { available: Platform[] }) {
  const { activeFilters, toggleRead } = useSession();
  // Only meaningful when there's more than one chat to choose between.
  if (available.length < 2) return null;

  return (
    <Flex
      flex="none"
      align="center"
      gap="8px"
      px={{ base: "12px", md: "22px" }}
      h="38px"
      borderBottomWidth="1px"
      borderColor="line"
    >
      <Text fontFamily="mono" fontSize="10px" letterSpacing="0.06em" color="faint" flex="none">
        WATCHING
      </Text>
      {available.map((id) => {
        const color = PLATFORM_COLOR[id];
        const reading = activeFilters.has(id);
        const label = PLATFORM_LABEL[id];
        return (
          <chakra.button
            key={id}
            type="button"
            onClick={() => toggleRead(id)}
            title={reading ? `Hide ${label} chat` : `Show ${label} chat`}
            aria-pressed={reading}
            display="inline-flex"
            alignItems="center"
            gap="6px"
            flex="none"
            px="9px"
            py="4px"
            borderRadius="full"
            borderWidth="1px"
            borderColor={reading ? `${color}55` : "line"}
            bg={reading ? `${color}14` : "transparent"}
            color={reading ? "text" : "faint"}
            opacity={reading ? 1 : 0.6}
            cursor="pointer"
            transition="background .12s, border-color .12s, opacity .12s, color .12s"
            _hover={{ opacity: 1, borderColor: `${color}55` }}
          >
            <PlatformIcon platform={id} color={color} size={13} />
            <Text fontSize="11px" fontWeight="600">
              {label}
            </Text>
            <EyeIcon open={reading} />
          </chakra.button>
        );
      })}
    </Flex>
  );
}
