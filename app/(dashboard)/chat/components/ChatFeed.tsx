"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { Flex, Box, Text } from "@chakra-ui/react";
import type { ChatMessage as ChatMessageType, Platform, UserSelection } from "../../types";
import ChatMessage from "./ChatMessage";

interface ChatFeedProps {
  messages: ChatMessageType[];
  activeFilters: Set<Platform>;
  onSelectUser?: (selection: UserSelection) => void;
}

const STICK_THRESHOLD_PX = 60;

export default function ChatFeed({ messages, activeFilters, onSelectUser }: ChatFeedProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hovering, setHovering] = useState(false);
  // Whether the feed should follow the live edge. This ref is flipped ONLY by a
  // genuine user scroll (handleScroll below) — never by the geometry churn of
  // appending new rows and trimming old ones off the top. That churn is exactly
  // what used to spuriously "unstick" a fast chat and freeze it on a jump pill.
  const stuckRef = useRef(true);
  // State mirror of stuckRef, purely to drive the pill (React bails when the
  // boolean doesn't change, so sitting at the bottom doesn't cause re-renders).
  const [atBottom, setAtBottom] = useState(true);

  const pinToBottom = () => {
    const el = containerRef.current;
    if (!el) return;
    // Direct scrollTop assignment — avoids CSS smooth-scroll, which pauses GIF
    // animation in Chrome for the duration of the scroll animation.
    el.scrollTop = el.scrollHeight;
  };

  const handleScroll = () => {
    const el = containerRef.current;
    if (!el) return;
    const nowStuck = el.scrollHeight - el.scrollTop - el.clientHeight < STICK_THRESHOLD_PX;
    stuckRef.current = nowStuck;
    setAtBottom(nowStuck);
  };

  const jumpToLatest = () => {
    stuckRef.current = true;
    setAtBottom(true);
    pinToBottom();
  };

  // Re-pin to the live edge BEFORE the browser paints. Running in a layout effect
  // (rather than useEffect + rAF, which fire AFTER paint) is what fixes the
  // fast-chat pause: when the feed appends new rows and trims old ones off the
  // top, we snap back to the bottom synchronously, so no scroll event ever
  // observes a transient "scrolled up" geometry mid-frame and flips us off the
  // live edge. Only a real user scroll (handleScroll) can unstick us now.
  useLayoutEffect(() => {
    if (!stuckRef.current) return;
    const el = containerRef.current;
    if (!el) return;
    // Authoritative pause check: `:hover` is a live DOM state, so it stays
    // correct even if React re-mounted this component or a stray mouseleave
    // fired. This is what makes hovering a *true* pause — never scroll out from
    // under the cursor. (Appending rows fires no scroll event, so hovering keeps
    // stuckRef true; we resume from mouseleave below.)
    if (el.matches(":hover")) return;
    pinToBottom();
  }, [messages]);

  const filtered = messages.filter((m) => {
    if (m.platform === "self") {
      // When a single platform is filtered (split view), only show the self
      // message in the pane(s) that match the platforms it was sent to.
      if (m.platforms?.length) return m.platforms.some((p) => activeFilters.has(p));
      return activeFilters.size > 0;
    }
    return activeFilters.has(m.platform as Platform);
  });

  // In single-platform view, show only the relevant display name for self-messages.
  const singlePlatform: Platform | undefined =
    activeFilters.size === 1 ? ([...activeFilters][0] as Platform) : undefined;

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

  const showPill = hovering || !atBottom;

  return (
    <Box
      position="relative"
      flex="1"
      minW="0"
      // min-height:0 is required — this wrapper is a flex item AND a flex column
      // with a scrolling child. Without it the wrapper's default min-height:auto
      // grows to fit all messages (the inner overflow:auto never gets a bounded
      // height), so the feed can't scroll and just runs off the bottom.
      minH="0"
      display="flex"
      flexDirection="column"
    >
      <Box
        ref={containerRef}
        flex="1"
        minW="0"
        minH="0"
        overflowY="auto"
        overflowX="hidden"
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => {
          setHovering(false);
          // Resume following the live edge the moment the cursor leaves, if we
          // were still stuck to the bottom when the hover began. New messages
          // that arrived during the hover fired no scroll event, so stuckRef is
          // untouched — but nothing has re-pinned us to the (now taller) bottom.
          if (stuckRef.current) pinToBottom();
        }}
        px={{ base: "12px", md: "22px" }}
        py="4px"
        display="flex"
        flexDirection="column"
        gap="2px"
        // Disable scroll anchoring: when new rows append, the browser would
        // otherwise nudge scrollTop to "keep" a visible row and fire a scroll
        // event that spuriously unsticks us from the bottom — the feed then
        // parks on a message instead of following the live edge.
        style={{ overflowAnchor: "none" }}
        onScroll={handleScroll}
      >
        {filtered.map((msg) => (
          <ChatMessage
            key={msg.id}
            message={msg}
            onSelectUser={onSelectUser}
            singlePlatform={singlePlatform}
          />
        ))}
      </Box>

      {showPill && (
        <Flex
          position="absolute"
          bottom="10px"
          left="50%"
          transform="translateX(-50%)"
          align="center"
          gap="6px"
          h="26px"
          px="12px"
          borderRadius="13px"
          bg="panel"
          borderWidth="1px"
          borderColor="line"
          color="muted"
          fontSize="11px"
          fontWeight="500"
          boxShadow="0 4px 14px rgba(0,0,0,0.28)"
          cursor={!atBottom ? "pointer" : "default"}
          style={{ pointerEvents: !atBottom ? "auto" : "none" }}
          onClick={!atBottom ? jumpToLatest : undefined}
          title={!atBottom ? "Jump to the newest messages" : undefined}
        >
          {!atBottom ? (
            <>
              <Text as="span" lineHeight="1">↓</Text>
              <Text as="span">Paused — jump to latest</Text>
            </>
          ) : (
            <Text as="span">Auto-scroll paused (hovering)</Text>
          )}
        </Flex>
      )}
    </Box>
  );
}
