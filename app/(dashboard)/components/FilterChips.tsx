"use client";

import { Flex, Box, chakra } from "@chakra-ui/react";
import type { Platform } from "../chat/types";
import { PlatformIcon } from "./PlatformIcon";

const PLATFORMS: { id: Platform; label: string; color: string }[] = [
  { id: "twitch", label: "Twitch", color: "#A66CFF" },
  { id: "youtube", label: "YouTube", color: "#FF5C5C" },
  { id: "kick", label: "Kick", color: "#5BE37D" },
];

interface FilterChipsProps {
  active: Set<Platform>;
  onChange: (platform: Platform) => void;
}

export default function FilterChips({ active, onChange }: FilterChipsProps) {
  return (
    <Flex align="center" gap="8px">
      {PLATFORMS.map(({ id, label, color }) => {
        const on = active.has(id);
        return (
          <chakra.button
            key={id}
            type="button"
            onClick={() => onChange(id)}
            display="flex"
            alignItems="center"
            gap="8px"
            px="13px"
            py="6px"
            borderRadius="999px"
            fontFamily="mono"
            fontSize="12px"
            cursor="pointer"
            transition="background .12s, border-color .12s, color .12s"
            style={
              on
                ? { background: `${color}1F`, border: `1px solid ${color}99`, color }
                : { background: "transparent", border: "1px solid #232a38", color: "#8B93A7" }
            }
          >
            <Box as="span" display="inline-flex" opacity={on ? 1 : 0.4}>
              <PlatformIcon platform={id} color={color} size={14} />
            </Box>
            {label}
          </chakra.button>
        );
      })}
    </Flex>
  );
}
