"use client";

import { Box, Flex, Text, chakra } from "@chakra-ui/react";

interface EmoteAutocompleteProps {
  items: [string, string][]; // [code, url]
  selectedIdx: number;
  onPick: (code: string, url: string) => void;
}

// Inline ":shortcode" emote suggestions — a horizontal strip above the composer,
// navigated with ←/→. Rendered only when `items` is non-empty.
export default function EmoteAutocomplete({ items, selectedIdx, onPick }: EmoteAutocompleteProps) {
  if (items.length === 0) return null;
  return (
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
        {items.map(([code, url], idx) => {
          const selected = idx === selectedIdx;
          return (
            <chakra.button
              key={code}
              type="button"
              onClick={() => onPick(code, url)}
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
  );
}
