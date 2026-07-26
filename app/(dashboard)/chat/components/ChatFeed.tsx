"use client";

import { useEffect, useRef, useState } from "react";
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
  const [paused, setPaused] = useState(false);
  // Whether the feed is pinned to the live edge. The ref drives the auto-scroll
  // decision (read synchronously, no re-render); the state mirror drives the
  // "paused" pill (React bails when the boolean doesn't actually change, so
  // scroll events while sitting at the bottom don't cause re-renders).
  const stuckRef = useRef(true);
  const [atBottom, setAtBottom] = useState(true);
  const rafRef = useRef<number | null>(null);

  const handleScroll = () => {
    const el = containerRef.current;
    if (!el) return;
    const nowStuck = el.scrollHeight - el.scrollTop - el.clientHeight < STICK_THRESHOLD_PX;
    stuckRef.current = nowStuck;
    setAtBottom(nowStuck);
  };

  const jumpToLatest = () => {
    const el = containerRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
    stuckRef.current = true;
    setAtBottom(true);
  };

  useEffect(() => {
    if (paused || !stuckRef.current) {
      // Cancel any scroll queued a frame ago so hovering / scrolling up can't
      // get yanked back down by an in-flight autoscroll.
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      return;
    }
    // Coalesce bursts: several messages can arrive between paints, but we only
    // need one scroll per frame. Reading scrollHeight forces a synchronous
    // layout, so doing it once per frame instead of once per message is the win.
    if (rafRef.current != null) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      const el = containerRef.current;
      if (!el) return;
      // Authoritative pause check: `:hover` is a live DOM state, so it stays
      // correct even if React re-mounted this component (which would reset the
      // `paused` state back to false) or a stray mouseleave fired. This is what
      // makes hovering a *true* pause — never scroll out from under the cursor.
      if (el.matches(":hover")) return;
      // Direct scrollTop assignment — avoids CSS smooth-scroll which pauses GIF
      // animation in Chrome for the duration of the scroll animation.
      el.scrollTop = el.scrollHeight;
    });
  }, [messages, paused]);

  useEffect(
    () => () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    },
    []
  );

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

  const showPill = paused || !atBottom;

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
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
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
