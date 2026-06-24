"use client";

// TODO: channel and mod permissions will come from the authenticated streamer
// account once OAuth is added. For now, channel is stored in localStorage.

import { useState } from "react";
import { Box, Flex, Input, Button, Text, chakra } from "@chakra-ui/react";
import type { ConnectionStatus } from "../types";

const STATUS_COLOR: Record<ConnectionStatus, string> = {
  idle: "#5C6479",
  connecting: "#F5A623",
  connected: "#5BE37D",
  error: "#FF5C5C",
};

const STATUS_LABEL: Record<ConnectionStatus, string> = {
  idle: "offline",
  connecting: "connecting…",
  connected: "live",
  error: "error — check channel name",
};

interface YourChannelBarProps {
  channel: string;
  status: ConnectionStatus;
  onSave: (channel: string) => void;
}

export default function YourChannelBar({ channel, status, onSave }: YourChannelBarProps) {
  const [editing, setEditing] = useState(!channel);
  const [input, setInput] = useState(channel);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const ch = input.trim().toLowerCase().replace(/^#/, "");
    if (ch) {
      onSave(ch);
      setEditing(false);
    }
  }

  if (editing) {
    return (
      <Box flex="none" borderBottomWidth="1px" borderColor="line" px="24px" py="14px">
        <Flex as="form" align="center" gap="8px" onSubmit={handleSubmit}>
          <Text fontFamily="mono" fontSize="14px" color="faint">
            #
          </Text>
          <Input
            flex="1"
            autoFocus
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="your-channel"
            fontFamily="mono"
            fontSize="14px"
            bg="field"
            borderColor="fieldLine"
            borderRadius="8px"
            px="12px"
            py="6px"
            color="text"
            _placeholder={{ color: "faint" }}
            _focusVisible={{ borderColor: "muted", boxShadow: "none" }}
          />
          <Button
            type="submit"
            bg="raised"
            borderWidth="1px"
            borderColor="line"
            color="text"
            fontSize="14px"
            fontWeight="500"
            borderRadius="8px"
            px="16px"
            _hover={{ bg: "line" }}
          >
            Save
          </Button>
          {channel && (
            <chakra.button
              type="button"
              onClick={() => setEditing(false)}
              fontSize="12px"
              color="faint"
              cursor="pointer"
              _hover={{ color: "muted" }}
            >
              Cancel
            </chakra.button>
          )}
        </Flex>
        <Text mt="6px" fontFamily="mono" fontSize="11px" color="faint">
          Your stream — auto-connects on load
        </Text>
      </Box>
    );
  }

  return (
    <Flex
      flex="none"
      align="center"
      gap="10px"
      borderBottomWidth="1px"
      borderColor="line"
      px="24px"
      py="10px"
    >
      <Text fontFamily="mono" fontSize="11px" color="faint" textTransform="uppercase" letterSpacing="0.06em">
        Your stream
      </Text>
      <Box h="12px" w="1px" bg="line" />
      <Box w="7px" h="7px" borderRadius="full" bg={STATUS_COLOR[status]} />
      <Text fontFamily="mono" fontSize="12px" color="muted">
        {STATUS_LABEL[status]}
      </Text>
      {channel && (
        <Text fontFamily="mono" fontSize="14px" color="text">
          #{channel}
        </Text>
      )}
      <chakra.button
        type="button"
        ml="auto"
        onClick={() => {
          setInput(channel);
          setEditing(true);
        }}
        fontFamily="mono"
        fontSize="11px"
        color="faint"
        cursor="pointer"
        _hover={{ color: "muted" }}
      >
        change
      </chakra.button>
    </Flex>
  );
}
