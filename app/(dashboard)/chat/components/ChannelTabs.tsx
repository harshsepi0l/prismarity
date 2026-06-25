"use client";

import { Flex, Box, chakra } from "@chakra-ui/react";

const SPECTRUM = "linear-gradient(90deg,#A66CFF,#FF5C5C,#5BE37D)";

interface ChannelTabsProps {
  channels: string[];
  active: string | null;
  onSelect: (channel: string) => void;
  onClose: (channel: string) => void;
}

export default function ChannelTabs({ channels, active, onSelect, onClose }: ChannelTabsProps) {
  if (channels.length === 0) return null;

  return (
    <Flex flex="none" align="center" gap="4px" overflowX="auto" borderBottomWidth="1px" borderColor="line" px="20px" py="8px">
      {channels.map((ch) => {
        const isActive = ch === active;
        return (
          <Flex
            key={ch}
            position="relative"
            align="center"
            gap="4px"
            flex="none"
            px="10px"
            py="4px"
            borderRadius="6px"
            fontSize="12px"
            borderWidth="1px"
            bg={isActive ? "raised" : "transparent"}
            borderColor={isActive ? "line" : "transparent"}
            color={isActive ? "text" : "faint"}
            transition="background .12s, color .12s"
          >
            {isActive && (
              <Box
                position="absolute"
                left="8px"
                right="8px"
                bottom="0"
                h="1px"
                borderRadius="full"
                style={{ background: SPECTRUM }}
              />
            )}
            <chakra.button type="button" onClick={() => onSelect(ch)} fontFamily="mono" fontWeight="500" cursor="pointer">
              #{ch}
            </chakra.button>
            <chakra.button
              type="button"
              onClick={(e: React.MouseEvent) => {
                e.stopPropagation();
                onClose(ch);
              }}
              aria-label={`Close ${ch}`}
              ml="2px"
              lineHeight="1"
              color="faint"
              cursor="pointer"
              _hover={{ color: "muted" }}
            >
              ×
            </chakra.button>
          </Flex>
        );
      })}
    </Flex>
  );
}
