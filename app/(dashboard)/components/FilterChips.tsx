"use client";

import { Flex, Box, chakra } from "@chakra-ui/react";
import type { Platform } from "../chat/types";
import { PlatformIcon } from "./PlatformIcon";

const PLATFORMS: { id: Platform; label: string; color: string }[] = [
  { id: "twitch", label: "Twitch", color: "#A66CFF" },
  { id: "kick", label: "Kick", color: "#5BE37D" },
  { id: "youtube", label: "YouTube", color: "#FF5C5C" },
];

interface FilterChipsProps {
  active: Set<Platform>;
  connected: Set<Platform>;
  onChange: (platform: Platform) => void;
}

export default function FilterChips({ active, connected, onChange }: FilterChipsProps) {
  return (
    <Flex align="center" gap="8px">
      {PLATFORMS.map(({ id, label, color }) => {
        const isConnected = connected.has(id);
        const on = isConnected && active.has(id);
        return (
          <chakra.button
            key={id}
            type="button"
            disabled={!isConnected}
            onClick={() => isConnected && onChange(id)}
            title={isConnected ? label : `${label} — not connected`}
            display="flex"
            alignItems="center"
            gap="8px"
            px="13px"
            py="6px"
            borderRadius="999px"
            fontFamily="mono"
            fontSize="12px"
            cursor={isConnected ? "pointer" : "not-allowed"}
            transition="background .12s, border-color .12s, color .12s, box-shadow .12s, transform .1s"
            _hover={
              isConnected
                ? {
                    transform: "translateY(-2px)",
                    boxShadow: on
                      ? `0 0 22px ${color}80, 0 0 8px ${color}50, 0 6px 20px rgba(0,0,0,0.6)`
                      : `0 0 12px ${color}35, 0 6px 20px rgba(0,0,0,0.55)`,
                  }
                : undefined
            }
            style={
              !isConnected
                ? { background: "transparent", border: "1px solid #232a38", color: "#5C6479", opacity: 0.4 }
                : on
                  ? { background: `${color}1F`, border: `1px solid ${color}99`, color }
                  : { background: "transparent", border: "1px solid #232a38", color: "#8B93A7" }
            }
          >
            <Box as="span" display="inline-flex" opacity={on ? 1 : 0.5}>
              <PlatformIcon platform={id} color={color} size={14} />
            </Box>
            {label}
          </chakra.button>
        );
      })}
    </Flex>
  );
}
