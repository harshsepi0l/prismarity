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
  modes: Mode[];
  onChange: (mode: Mode) => void;
}

export default function ModeToggle({ mode, modes, onChange }: ModeToggleProps) {
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
            transition="background .12s, color .12s, box-shadow .12s, transform .1s"
            _hover={active ? { boxShadow: "0 2px 10px rgba(0,0,0,0.4)" } : { color: "muted", boxShadow: "0 2px 8px rgba(0,0,0,0.3)" }}
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
