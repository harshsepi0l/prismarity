"use client";

import { Flex, Box, chakra } from "@chakra-ui/react";
import type { Mode } from "../useSession";

const SPECTRUM = "linear-gradient(90deg,#A66CFF,#FF5C5C,#5BE37D)";

const MODES: { id: Mode; label: string }[] = [
  { id: "creator", label: "Creator" },
  { id: "moderator", label: "Moderator" },
  { id: "viewer", label: "Viewer" },
];

interface ModeToggleProps {
  mode: Mode;
  onChange: (mode: Mode) => void;
}

export default function ModeToggle({ mode, onChange }: ModeToggleProps) {
  return (
    <Flex align="center" borderWidth="1px" borderColor="line" bg="raised" borderRadius="8px" p="2px">
      {MODES.map(({ id, label }) => {
        const active = mode === id;
        return (
          <chakra.button
            key={id}
            type="button"
            onClick={() => onChange(id)}
            position="relative"
            px="12px"
            py="4px"
            borderRadius="6px"
            fontSize="12px"
            fontWeight="500"
            cursor="pointer"
            bg={active ? "panel" : "transparent"}
            color={active ? "text" : "faint"}
            transition="background .12s, color .12s"
            _hover={active ? undefined : { color: "muted" }}
          >
            {active && (
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
            {label}
          </chakra.button>
        );
      })}
    </Flex>
  );
}
