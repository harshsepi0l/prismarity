"use client";

import { useState } from "react";
import { Box, Flex, Input, Button, Text } from "@chakra-ui/react";
import type { Platform } from "../types";
import { PlatformIcon } from "../../components/PlatformIcon";

const DOTS: { id: Platform; color: string }[] = [
  { id: "twitch", color: "#A66CFF" },
  { id: "youtube", color: "#FF5C5C" },
  { id: "kick", color: "#5BE37D" },
];

interface ComposerProps {
  litPlatforms: Set<Platform>;
}

// Send is preview-only for now — no real cross-posting happens.
export default function Composer({ litPlatforms }: ComposerProps) {
  const [text, setText] = useState("");

  return (
    <Box flex="none" px="24px" pt="16px" pb="22px">
      <Flex
        as="form"
        align="center"
        gap="12px"
        bg="field"
        borderWidth="1px"
        borderColor="fieldLine"
        borderRadius="10px"
        pl="16px"
        pr="6px"
        py="6px"
        onSubmit={(e: React.FormEvent) => e.preventDefault()}
      >
        <Input
          flex="1"
          variant="flushed"
          border="none"
          px="0"
          fontSize="14px"
          color="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Message all your platforms at once…"
          _placeholder={{ color: "muted" }}
          _focusVisible={{ outline: "none", boxShadow: "none", borderColor: "transparent" }}
        />
        <Flex align="center" gap="6px" pr="4px">
          {DOTS.map(({ id, color }) => (
            <Box
              key={id}
              as="span"
              display="inline-flex"
              opacity={litPlatforms.has(id) ? 1 : 0.22}
            >
              <PlatformIcon platform={id} color={color} size={15} />
            </Box>
          ))}
        </Flex>
        <Button
          type="submit"
          flex="none"
          bg="#4f4c4c"
          fontWeight="600"
          fontSize="14px"
          px="20px"
          py="9px"
          borderRadius="7px"
          _hover={{ bg: "#968f8f" }}
        >
          Send
        </Button>
      </Flex>
      <Text mt="9px" fontFamily="mono" fontSize="10px" color="faint" letterSpacing="0.04em">
        Sends to the platforms lit above.
      </Text>
    </Box>
  );
}
