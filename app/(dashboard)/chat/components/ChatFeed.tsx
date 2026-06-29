"use client";

import { useEffect, useRef, useState } from "react";
import { Flex, Box, Text } from "@chakra-ui/react";
import type { ChatMessage as ChatMessageType, Platform, UserSelection } from "../types";
import ChatMessage from "./ChatMessage";

interface ChatFeedProps {
  messages: ChatMessageType[];
  activeFilters: Set<Platform>;
  onSelectUser?: (selection: UserSelection) => void;
}

export default function ChatFeed({ messages, activeFilters, onSelectUser }: ChatFeedProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    const el = containerRef.current;
    // Direct scrollTop assignment — avoids CSS smooth-scroll which pauses GIF
    // animation in Chrome for the duration of the scroll animation.
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, paused]);

  const filtered = messages.filter(
    (m) => m.platform === "self" || activeFilters.has(m.platform as Platform)
  );

  if (filtered.length === 0) {
    return (
      <Flex
        flex="1"
        direction="column"
        align="center"
        justify="center"
        gap="10px"
        textAlign="center"
      >
        <Text fontSize="14px" color="muted">
          No messages yet
        </Text>
        <Text fontSize="12px" color="faint">
          Select a channel to load its chat
        </Text>
      </Flex>
    );
  }

  return (
    <Box
      ref={containerRef}
      flex="1"
      overflowY="auto"
      px="22px"
      py="4px"
      display="flex"
      flexDirection="column"
      gap="2px"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {filtered.map((msg) => (
        <ChatMessage
          key={msg.id}
          message={msg}
          onSelectUser={onSelectUser}
        />
      ))}
    </Box>
  );
}
