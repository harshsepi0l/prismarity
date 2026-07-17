"use client";

import { Box, Flex, Text, chakra } from "@chakra-ui/react";
import { PlatformIcon, PLATFORM_COLOR } from "../../../components/PlatformIcon";
import type { MentionCandidate } from "../../../_ctx/chat";

interface MentionAutocompleteProps {
  items: MentionCandidate[];
  selectedIdx: number;
  onPick: (candidate: MentionCandidate) => void;
}

// "@mention" suggestions — a vertical list of recent chatters (scoped to the
// active send targets), navigated with ↑/↓. Username only, no avatars; the
// chatter's own name color is used, falling back to the platform color.
export default function MentionAutocomplete({ items, selectedIdx, onPick }: MentionAutocompleteProps) {
  if (items.length === 0) return null;
  return (
    <Box
      position="absolute"
      bottom="100%"
      left="0"
      mb="8px"
      minW="180px"
      maxW="100%"
      bg="panel"
      borderWidth="1px"
      borderColor="line"
      borderRadius="10px"
      zIndex={5}
      overflow="hidden"
    >
      <Flex px="8px" pt="5px" pb="3px" justify="space-between" align="center" gap="12px">
        <Text fontSize="9px" fontFamily="mono" letterSpacing="0.1em" color="faint">
          MENTIONS
        </Text>
        <Text fontSize="9px" color="faint">
          ↑↓ navigate · Enter insert · Esc close
        </Text>
      </Flex>
      <Flex direction="column" p="4px" pt="0" maxH="220px" overflowY="auto">
        {items.map((c, idx) => {
          const selected = idx === selectedIdx;
          const color = c.color || PLATFORM_COLOR[c.platform];
          return (
            <chakra.button
              key={`${c.platform}:${c.user}`}
              type="button"
              onClick={() => onPick(c)}
              title={`@${c.user}`}
              display="flex"
              alignItems="center"
              gap="8px"
              w="100%"
              px="8px"
              py="5px"
              borderRadius="6px"
              cursor="pointer"
              bg={selected ? "raised" : "transparent"}
              transition="background .1s"
              _hover={{ bg: "raised" }}
            >
              <PlatformIcon platform={c.platform} color={PLATFORM_COLOR[c.platform]} size={12} />
              <Text fontSize="13px" fontWeight="600" color={color} truncate>
                {c.user}
              </Text>
            </chakra.button>
          );
        })}
      </Flex>
    </Box>
  );
}
