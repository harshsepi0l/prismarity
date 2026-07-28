"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Flex, Box, Text } from "@chakra-ui/react";
import type { ChatMessage as ChatMessageType, Platform, UserSelection } from "../../types";
import ChatMessage from "./ChatMessage";
import { useChatPrefs, matchesKeywords } from "../../_ctx/chatPrefs";
import { c, accentMix } from "../../../theme-colors";

interface ChatFeedProps {
  messages: ChatMessageType[];
  activeFilters: Set<Platform>;
  onSelectUser?: (selection: UserSelection) => void;
}

// Treat "within this many px of the end" as still pinned to the live edge, so a
// single tall row appended just below the fold doesn't read as "scrolled up".
const STICK_SLACK_PX = 80;

// How long a hover holds auto-scroll before it auto-resumes. Pure cursor on/off:
// cursor ON starts a fresh N-second timer, cursor OFF cancels it and resumes;
// coming back ON starts N seconds over again.
const HOVER_PAUSE_SECS = 5;

export default function ChatFeed({ messages, activeFilters, onSelectUser }: ChatFeedProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Seconds left on the hover-pause countdown; null when not hover-paused. Drives
  // both the pill and the little timer shown inside it.
  const [countdown, setCountdown] = useState<number | null>(null);
  // Whether we're pinned to the live edge. Decided by an IntersectionObserver
  // watching a sentinel at the very bottom — NOT by scrollHeight/scrollTop math.
  // That math silently breaks once the buffer fills and rows prune off the top
  // every frame (the shrinking "distance from bottom" would dip under a px
  // threshold and wrongly resume) — the "pause stops working once the scrollbar
  // gets small" bug. Sentinel visibility can't be corrupted by pruning. The ref
  // drives the hot path (read synchronously); the state mirror drives the pill.
  const followRef = useRef(true);
  const [atBottom, setAtBottom] = useState(true);

  const { blacklistKeywords, pauseOnHover } = useChatPrefs();

  // Hover-pause: cursor ON holds auto-scroll for HOVER_PAUSE_SECS then resumes;
  // cursor OFF cancels it. `hoverPausedRef` is the hot-path mirror the pin effect
  // and the observer read; a 1s interval ticks the visible countdown to 0.
  const hoverPausedRef = useRef(false);
  const hoverIntervalRef = useRef<number | null>(null);

  const filtered = messages.filter((m) => {
    // Hide messages containing a blacklisted keyword (never your own sent lines).
    if (m.platform !== "self" && matchesKeywords(m.text, blacklistKeywords)) return false;
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

  const isEmpty = filtered.length === 0;

  const pinToBottom = () => {
    const el = containerRef.current;
    // Direct scrollTop assignment — avoids CSS smooth-scroll, which pauses GIF
    // animation in Chrome for the duration of the scroll animation.
    if (el) el.scrollTop = el.scrollHeight;
  };

  // Follow the live edge BEFORE paint whenever we're pinned and not paused. A
  // layout effect (not a post-paint rAF) lands the snap in the same frame the
  // rows mutate, so there's no visible jump and no half-updated frame to latch a
  // false state onto.
  useLayoutEffect(() => {
    if (!followRef.current || hoverPausedRef.current) return;
    pinToBottom();
  }, [messages]);

  // Stick detection: is the bottom sentinel on screen? Re-attached whenever the
  // feed mounts (isEmpty flips). Updates are SKIPPED while hover-paused — messages
  // accumulating during a hover push the sentinel out of view, and that must not
  // be mistaken for the user scrolling away.
  useEffect(() => {
    if (isEmpty) return;
    const el = containerRef.current;
    const sentinel = sentinelRef.current;
    if (!el || !sentinel) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (hoverPausedRef.current) return;
        followRef.current = entry.isIntersecting;
        setAtBottom(entry.isIntersecting);
      },
      // A positive bottom rootMargin extends the root's box downward, so the
      // sentinel still counts as "visible" within STICK_SLACK_PX of the end.
      { root: el, rootMargin: `0px 0px ${STICK_SLACK_PX}px 0px`, threshold: 0 }
    );
    io.observe(sentinel);
    return () => io.disconnect();
  }, [isEmpty]);

  const clearHoverInterval = () => {
    if (hoverIntervalRef.current != null) {
      clearInterval(hoverIntervalRef.current);
      hoverIntervalRef.current = null;
    }
  };

  // Release the hover-pause. Resume to the live edge only if we were following
  // when the hover began (followRef is frozen during a hover, so it still
  // reflects that) — a hover that started while scrolled up leaves the read
  // position alone.
  const endHoverPause = () => {
    clearHoverInterval();
    hoverPausedRef.current = false;
    setCountdown(null);
    if (followRef.current) pinToBottom();
  };

  // Cursor ON: (re)start a fresh N-second countdown. A closure counter (not the
  // render state) drives the tick, so the resume is decided outside the setState
  // updater — one tick per second updates the pill's timer, and hitting 0 ends the
  // pause and lets the feed catch up.
  const beginHoverPause = () => {
    if (!pauseOnHover) return;
    clearHoverInterval();
    hoverPausedRef.current = true;
    let remaining = HOVER_PAUSE_SECS;
    setCountdown(remaining);
    hoverIntervalRef.current = window.setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) endHoverPause();
      else setCountdown(remaining);
    }, 1000);
  };

  // Wheeling while hovering = the user is taking manual scroll control, so drop
  // the hover countdown and hand follow-state back to the sentinel. A scroll-up
  // means they're leaving the live edge — reflect that at once so an incoming
  // message can't yank them down before the observer's async callback catches up.
  const onWheel = (e: { deltaY: number }) => {
    if (!hoverPausedRef.current) return;
    clearHoverInterval();
    hoverPausedRef.current = false;
    setCountdown(null);
    if (e.deltaY < 0) {
      followRef.current = false;
      setAtBottom(false);
    }
  };

  // Turning the pref off (or unmounting) must release any live hover-pause. Runs
  // only when the pref flips (rare) — the setState cascade the lint warns about is
  // a non-issue at that frequency and is what clears the pill.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!pauseOnHover) endHoverPause();
    return clearHoverInterval;
    // Helpers close over current refs; re-running only on the pref flip is intended.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pauseOnHover]);

  const jumpToLatest = () => {
    clearHoverInterval();
    hoverPausedRef.current = false;
    setCountdown(null);
    followRef.current = true;
    setAtBottom(true);
    pinToBottom();
  };

  if (isEmpty) {
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

  const showPill = !atBottom || countdown !== null;

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
        onMouseEnter={beginHoverPause}
        onMouseLeave={endHoverPause}
        onWheel={onWheel}
        px={{ base: "12px", md: "22px" }}
        py="4px"
        display="flex"
        flexDirection="column"
        gap="2px"
      >
        {filtered.map((msg) => (
          <ChatMessage
            key={msg.id}
            message={msg}
            onSelectUser={onSelectUser}
            singlePlatform={singlePlatform}
          />
        ))}
        {/* Live-edge marker the IntersectionObserver watches. Must not shrink to
            0 in the flex column, or it could never register as visible. */}
        <Box ref={sentinelRef} h="1px" flexShrink={0} aria-hidden />
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
            <>
              <Text as="span">Paused — resuming in</Text>
              {/* Little countdown timer: an amber badge showing the seconds left
                  on the hover-pause, ticking down 5 → 1. */}
              <Flex
                align="center"
                justify="center"
                w="16px"
                h="16px"
                borderRadius="full"
                fontFamily="mono"
                fontSize="10px"
                fontWeight="700"
                flex="none"
                style={{
                  color: c.accent,
                  background: accentMix(16),
                  border: `1px solid ${accentMix(45)}`,
                }}
              >
                {countdown}
              </Flex>
            </>
          )}
        </Flex>
      )}
    </Box>
  );
}
