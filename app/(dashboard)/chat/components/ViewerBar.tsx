"use client";

import { useState } from "react";
import { Box, Flex, Input, Button, Text } from "@chakra-ui/react";
import type { ConnectionStatus } from "../types";

const STATUS_COLOR: Record<ConnectionStatus, string> = {
  idle: "#5C6479",
  connecting: "#F5A623",
  connected: "#5BE37D",
  error: "#FF5C5C",
};

const STATUS_LABEL: Record<ConnectionStatus, string> = {
  idle: "Enter a channel name to start watching",
  connecting: "Connecting…",
  connected: "Connected",
  error: "Connection failed — check the channel name",
};

interface ViewerBarProps {
  status: ConnectionStatus;
  onAdd: (channel: string) => void;
}

export default function ViewerBar({ status, onAdd }: ViewerBarProps) {
  const [input, setInput] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const ch = input.trim().toLowerCase().replace(/^#/, "");
    if (ch) {
      onAdd(ch);
      setInput("");
    }
  }

  return (
    <Box flex="none" borderBottomWidth="1px" borderColor="line" px="24px" py="14px">
      <Flex as="form" align="center" gap="8px" onSubmit={handleSubmit}>
        <Text fontFamily="mono" fontSize="14px" color="faint">
          #
        </Text>
        <Input
          flex="1"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Watch a channel…"
          fontFamily="mono"
          fontSize="14px"
          bg="field"
          borderColor="fieldLine"
          borderRadius="8px"
          px="12px"
          py="8px"
          color="text"
          _placeholder={{ color: "muted" }}
          _focusVisible={{ borderColor: "muted", boxShadow: "none" }}
        />
        <Button
          type="submit"
          disabled={!input.trim() || status === "connecting"}
          bg="raised"
          borderWidth="1px"
          borderColor="line"
          color="text"
          fontSize="14px"
          fontWeight="500"
          borderRadius="8px"
          px="16px"
          py="8px"
          _hover={{ bg: "line" }}
          _disabled={{ opacity: 0.5, cursor: "not-allowed" }}
        >
          Watch
        </Button>
      </Flex>
      <Flex mt="8px" align="center" gap="6px">
        <Box w="7px" h="7px" borderRadius="full" bg={STATUS_COLOR[status]} />
        <Text fontFamily="mono" fontSize="12px" color="faint">
          {STATUS_LABEL[status]}
        </Text>
      </Flex>
    </Box>
  );
}
