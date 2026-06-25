"use client";

import { Flex, Box, chakra } from "@chakra-ui/react";
import type { Mode } from "../useSession";

const SPECTRUM = "linear-gradient(90deg,#A66CFF,#FF5C5C,#5BE37D)";

const LABELS: Record<Mode, string> = {
  creator: "Creator",
  moderator: "Moderator",
  viewer: "Viewer",
};

interface ModeToggleProps {
  mode: Mode;
  modes: Mode[]; // only the modes allowed for the active channel
  onChange: (mode: Mode) => void;
}

export default function ModeToggle({ mode, modes, onChange }: ModeToggleProps) {
  // Render in a stable order regardless of how `modes` is ordered.
  const order: Mode[] = ["creator", "moderator", "viewer"];
  const shown = order.filter((m) => modes.includes(m));

  return (
    <Flex align="center" borderWidth="1px" borderColor="line" bg="raised" borderRadius="8px" p="2px">
      {shown.map((id) => {
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
            {LABELS[id]}
          </chakra.button>
        );
      })}
    </Flex>
  );
}
