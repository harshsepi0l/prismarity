"use client";

import { useRef, useState } from "react";
import { Flex, Box, Text } from "@chakra-ui/react";
import type { ChatMessage as ChatMessageType, Platform, UserSelection } from "../../types";
import ChatFeed from "./ChatFeed";
import { PlatformIcon, PLATFORM_COLOR, PLATFORM_LABEL } from "../../components/PlatformIcon";
import { useLayout } from "../../_ctx/layout";

const SPLIT_KEY = "prismarity:chat-split";
const MIN_RATIO = 0.2;
const MAX_RATIO = 0.8;

interface SplitChatViewProps {
  messages: ChatMessageType[];
  platforms: Platform[];
  onSelectUser?: (selection: UserSelection) => void;
}

export default function SplitChatView({ messages, platforms, onSelectUser }: SplitChatViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const dragStart = useRef<{ x: number; ratio: number } | null>(null);
  const [active, setActive] = useState(false);
  const { isMobile } = useLayout();

  const [splitRatio, setSplitRatio] = useState(() => {
    if (typeof window !== "undefined") {
      const v = parseFloat(localStorage.getItem(SPLIT_KEY) ?? "");
      if (!Number.isNaN(v) && v >= MIN_RATIO && v <= MAX_RATIO) return v;
    }
    return 0.5;
  });

  // Single platform — degrade gracefully to a plain feed.
  if (platforms.length <= 1) {
    const filter = new Set<Platform>(platforms);
    return <ChatFeed messages={messages} activeFilters={filter} onSelectUser={onSelectUser} />;
  }

  const left = platforms[0];
  const right = platforms[1];

  // Mobile: no room for side-by-side columns — stack them 50/50 vertically with
  // a static divider (horizontal drag doesn't translate to a vertical split).
  if (isMobile) {
    return (
      <Flex direction="column" flex="1" minH="0" minW="0">
        <Flex direction="column" flex="1" minH="0" minW="0">
          <ColumnHeader platform={left} />
          <ChatFeed messages={messages} activeFilters={new Set([left])} onSelectUser={onSelectUser} />
        </Flex>
        <Box h="1px" bg="line" flex="none" />
        <Flex direction="column" flex="1" minH="0" minW="0">
          <ColumnHeader platform={right} />
          <ChatFeed messages={messages} activeFilters={new Set([right])} onSelectUser={onSelectUser} />
        </Flex>
      </Flex>
    );
  }

  function onPointerDown(e: React.PointerEvent) {
    e.currentTarget.setPointerCapture(e.pointerId);
    dragStart.current = { x: e.clientX, ratio: splitRatio };
    setActive(true);
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!dragStart.current || e.buttons !== 1) return;
    const w = containerRef.current?.offsetWidth ?? 1;
    const delta = (e.clientX - dragStart.current.x) / w;
    const next = Math.min(MAX_RATIO, Math.max(MIN_RATIO, dragStart.current.ratio + delta));
    setSplitRatio(next);
    localStorage.setItem(SPLIT_KEY, String(next));
  }

  function onPointerUp() {
    dragStart.current = null;
    setActive(false);
  }

  return (
    <Flex ref={containerRef} flex="1" minH="0" minW="0">
      {/* Left column */}
      <Flex direction="column" style={{ flex: splitRatio }} minW="0">
        <ColumnHeader platform={left} />
        <ChatFeed
          messages={messages}
          activeFilters={new Set([left])}
          onSelectUser={onSelectUser}
        />
      </Flex>

      {/* Draggable divider */}
      <Box
        position="relative"
        flex="none"
        w="9px"
        cursor="col-resize"
        zIndex={10}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        <Box
          position="absolute"
          top="0"
          bottom="0"
          left="50%"
          w="2px"
          borderRadius="2px"
          transform="translateX(-50%)"
          pointerEvents="none"
          bg={active ? "rgba(166,108,255,0.55)" : "line"}
          transition="background .15s"
        />
        {/* Grip pill */}
        <Flex
          position="absolute"
          top="50%"
          left="50%"
          transform="translate(-50%, -50%)"
          w="20px"
          h="52px"
          borderRadius="6px"
          align="center"
          justify="center"
          pointerEvents="none"
          bg={active ? "#1F2532" : "transparent"}
          borderWidth="1px"
          borderColor={active ? "rgba(166,108,255,0.35)" : "transparent"}
          transition="background .15s, border-color .15s"
        >
          <svg
            width="6"
            height="16"
            viewBox="0 0 6 16"
            fill="rgba(166,108,255,0.75)"
            aria-hidden
            style={{ opacity: active ? 1 : 0, transition: "opacity .15s" }}
          >
            <circle cx="1.5" cy="2"  r="1.2" />
            <circle cx="4.5" cy="2"  r="1.2" />
            <circle cx="1.5" cy="8"  r="1.2" />
            <circle cx="4.5" cy="8"  r="1.2" />
            <circle cx="1.5" cy="14" r="1.2" />
            <circle cx="4.5" cy="14" r="1.2" />
          </svg>
        </Flex>
      </Box>

      {/* Right column */}
      <Flex direction="column" style={{ flex: 1 - splitRatio }} minW="0">
        <ColumnHeader platform={right} />
        <ChatFeed
          messages={messages}
          activeFilters={new Set([right])}
          onSelectUser={onSelectUser}
        />
      </Flex>
    </Flex>
  );
}

function ColumnHeader({ platform }: { platform: Platform }) {
  const color = PLATFORM_COLOR[platform];
  return (
    <Flex
      align="center"
      gap="7px"
      px="16px"
      h="34px"
      flex="none"
      borderBottomWidth="1px"
      borderColor="line"
    >
      <PlatformIcon platform={platform} size={12} color={color} />
      <Text
        fontFamily="mono"
        fontSize="11px"
        fontWeight="600"
        letterSpacing="0.12em"
        color={color}
      >
        {PLATFORM_LABEL[platform]}
      </Text>
    </Flex>
  );
}
