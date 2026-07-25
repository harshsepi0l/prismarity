"use client";

import { useEffect, useState } from "react";
import { Flex, Box, Text, chakra } from "@chakra-ui/react";
import type { PinItem } from "../../types";
import { useChatPins } from "../../_ctx/chat";
import { PlatformIcon, PLATFORM_COLOR } from "../../components/PlatformIcon";
import { BadgeChip } from "./ChatMessage";

const HYPE = "#F5A0FF"; // hype-train accent (bright twitch-pink)
const GOLD = "#F5C518"; // golden kappa train
const TW = PLATFORM_COLOR.twitch;

// Countdown-bar windows: a transient event drains over its 30s life; the Hype
// Train shows remaining time against a nominal 5-min level window (refills when a
// contribution extends the expiry, which is the real behaviour).
const EVENT_WINDOW_MS = 30_000;
const HYPE_WINDOW_MS = 300_000;

// The depleting timer for one item — its remaining fraction and accent — or null
// for the persistent mod-pin, which never expires.
function timerFor(item: PinItem, now: number): { pct: number; accent: string } | null {
  if (item.kind === "message") return null;
  const [expiresAt, windowMs, accent] =
    item.kind === "hype_train"
      ? [item.hype.expiresAt, HYPE_WINDOW_MS, item.hype.isGolden ? GOLD : HYPE]
      : item.kind === "hype_incoming"
        ? [item.hype.expiresAt, HYPE_WINDOW_MS, item.hype.isGolden ? GOLD : HYPE]
        : [item.expiresAt, EVENT_WINDOW_MS, item.platform === "kick" ? PLATFORM_COLOR.kick : TW];
  const pct = Math.max(0, Math.min(100, ((expiresAt - now) / windowMs) * 100));
  return { pct, accent };
}

// The pin/banner stack. Every active item (the mod-pin plus live events — Hype
// Train, announcements, raids, gifted subs) renders as its own notification row,
// stacked vertically. The mod-pin can be expanded (badges/name/sent time) and
// hidden.
export default function PinnedBar() {
  const { pinItems } = useChatPins();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  // A pin dismissed locally ("hide") — suppressed until it changes / re-pins.
  const [hiddenId, setHiddenId] = useState<string | null>(null);

  const items = pinItems.filter((it) => !(it.kind === "message" && it.id === hiddenId));

  // Local clock to animate the countdown bars while any timed item is present.
  const anyTimed = items.some((it) => it.kind !== "message");
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!anyTimed) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [anyTimed]);

  if (items.length === 0) return null;

  return (
    <Flex direction="column" flex="none" borderBottomWidth="1px" borderColor="line">
      {items.map((item, i) => (
        <PinRow
          key={item.id}
          item={item}
          first={i === 0}
          timer={timerFor(item, now)}
          expanded={item.kind === "message" && expandedId === item.id}
          onToggleExpand={() => setExpandedId((prev) => (prev === item.id ? null : item.id))}
          onHide={() => setHiddenId(item.id)}
        />
      ))}
    </Flex>
  );
}

function PinRow({
  item,
  first,
  timer,
  expanded,
  onToggleExpand,
  onHide,
}: {
  item: PinItem;
  first: boolean;
  timer: { pct: number; accent: string } | null;
  expanded: boolean;
  onToggleExpand: () => void;
  onHide: () => void;
}) {
  const isMessage = item.kind === "message";

  return (
    <Flex
      direction="column"
      gap="6px"
      px={{ base: "12px", md: "22px" }}
      py="7px"
      position="relative"
      bg={
        item.kind === "hype_train" || item.kind === "hype_incoming"
          ? "rgba(245,160,255,0.09)"
          : item.kind !== "message" && item.platform === "kick"
            ? "rgba(91,227,125,0.08)"
            : "rgba(166,108,255,0.08)"
      }
      borderTopWidth={first ? "0" : "1px"}
      borderColor="line"
    >
      {timer && (
        <Box
          position="absolute"
          top="0"
          left="0"
          h="2px"
          borderRadius="0 2px 2px 0"
          style={{
            width: `${timer.pct}%`,
            background: timer.accent,
            // Ease between the 1s clock steps so the drain reads as continuous.
            transition: "width 1s linear",
          }}
          aria-hidden
        />
      )}
      <Flex align="center" gap="10px">
        {isMessage ? (
          <Flex align="center" gap="8px" minW="0" flex="1">
            <Box as="span" flex="none" color={TW} display="inline-flex">
              <PinIcon size={13} />
            </Box>
            <PlatformIcon platform="twitch" size={12} color={TW} />
            <Text fontFamily="mono" fontSize="11px" letterSpacing="0.04em" color="muted" flex="none">
              Pinned by{" "}
              <chakra.span color="text" fontWeight="600">
                {item.pinnedBy ?? item.user}
              </chakra.span>
            </Text>
            <Text fontSize="13px" color="text" lineClamp={1} minW="0">
              <Linkified text={item.text} />
            </Text>
          </Flex>
        ) : (
          <ItemContent item={item} />
        )}

        {isMessage && (
          <Flex align="center" gap="4px" flex="none" ml="auto">
            <IconButton label={expanded ? "Collapse" : "Expand"} onClick={onToggleExpand}>
              <Chevron up={!expanded} />
            </IconButton>
            <IconButton label="Hide" onClick={onHide}>
              <XIcon />
            </IconButton>
          </Flex>
        )}
      </Flex>

      {isMessage && expanded && (
        <Flex align="center" gap="7px" pl="21px">
          {item.badges.length > 0 && (
            <Flex align="center" gap="3px" flex="none">
              {item.badges.slice(0, 5).map((b) => (
                <BadgeChip key={`${b.setId}:${b.id}`} platform="twitch" badge={b} accent={TW} />
              ))}
            </Flex>
          )}
          <Text fontWeight="600" fontSize="13px" color={item.color || TW}>
            {item.user}
          </Text>
          {item.sentAt != null && (
            <Text fontFamily="mono" fontSize="11px" color="faint">
              sent{" "}
              {new Date(item.sentAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </Text>
          )}
        </Flex>
      )}
    </Flex>
  );
}

// Split text into plain runs and clickable links.
function Linkified({ text }: { text: string }) {
  const parts = text.split(/(https?:\/\/[^\s]+)/g);
  return (
    <>
      {parts.map((part, i) =>
        /^https?:\/\//.test(part) ? (
          <chakra.a
            key={i}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            color={TW}
            textDecoration="underline"
            wordBreak="break-all"
            _hover={{ color: HYPE }}
          >
            {part}
          </chakra.a>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}

function ItemContent({ item }: { item: PinItem }) {
  if (item.kind === "hype_train") {
    const { hype } = item;
    const accent = hype.isGolden ? GOLD : HYPE;
    const pct = hype.goal > 0 ? Math.min(100, Math.round((hype.progress / hype.goal) * 100)) : 0;
    return (
      <Flex align="center" gap="10px" minW="0" flex="1">
        <Box as="span" flex="none" color={accent} display="inline-flex">
          <TrainIcon />
        </Box>
        <Text fontFamily="mono" fontSize="11px" fontWeight="700" letterSpacing="0.08em" color={accent} flex="none">
          {hype.isGolden ? "GOLDEN HYPE" : "HYPE TRAIN"} · LV{hype.level}
        </Text>
        {hype.goal > 0 && (
          <Box flex="1" minW="40px" maxW="220px" h="6px" borderRadius="3px" bg="raised" overflow="hidden">
            <Box h="100%" w={`${pct}%`} bg={accent} transition="width .3s" />
          </Box>
        )}
        <Text fontFamily="mono" fontSize="11px" color="muted" flex="none">
          {hype.total.toLocaleString()} pts
        </Text>
      </Flex>
    );
  }

  if (item.kind === "hype_incoming") {
    const { hype } = item;
    const accent = hype.isGolden ? GOLD : HYPE;
    const pct = hype.goal > 0 ? Math.min(100, Math.round((hype.progress / hype.goal) * 100)) : 0;
    return (
      <Flex align="center" gap="10px" minW="0" flex="1">
        <Box as="span" flex="none" color={accent} display="inline-flex" opacity={0.85}>
          <TrainIcon />
        </Box>
        <Text fontFamily="mono" fontSize="11px" fontWeight="700" letterSpacing="0.08em" color={accent} flex="none">
          {hype.isGolden ? "GOLDEN HYPE" : "HYPE TRAIN"} INCOMING
        </Text>
        {hype.goal > 0 && (
          <Box flex="1" minW="40px" maxW="220px" h="6px" borderRadius="3px" bg="raised" overflow="hidden">
            <Box h="100%" w={`${pct}%`} bg={accent} opacity={0.75} transition="width .3s" />
          </Box>
        )}
        <Text fontFamily="mono" fontSize="11px" color="muted" flex="none">
          {hype.progress}/{hype.goal}
        </Text>
      </Flex>
    );
  }

  if (item.kind === "raid") {
    const pc = item.platform === "kick" ? PLATFORM_COLOR.kick : TW;
    return (
      <Flex align="center" gap="9px" minW="0" flex="1">
        <Box as="span" flex="none" color={pc} display="inline-flex">
          <RaidIcon />
        </Box>
        <PlatformIcon platform={item.platform} size={12} color={pc} />
        <Text fontSize="13px" color="text" lineClamp={1} minW="0">
          <chakra.span fontWeight="700" color={pc}>
            {item.from}
          </chakra.span>{" "}
          {item.platform === "kick" ? "hosted" : "raided"} with {item.viewers.toLocaleString()} viewers
        </Text>
      </Flex>
    );
  }

  if (item.kind === "gift_sub") {
    const pc = item.platform === "kick" ? PLATFORM_COLOR.kick : TW;
    return (
      <Flex align="center" gap="9px" minW="0" flex="1">
        <Box as="span" flex="none" color={pc} display="inline-flex">
          <GiftIcon />
        </Box>
        <PlatformIcon platform={item.platform} size={12} color={pc} />
        <Text fontSize="13px" color="text" lineClamp={1} minW="0">
          <chakra.span fontWeight="700" color={pc}>
            {item.gifter}
          </chakra.span>{" "}
          gifted {item.count.toLocaleString()} sub{item.count === 1 ? "" : "s"}
        </Text>
      </Flex>
    );
  }

  if (item.kind === "sub") {
    const pc = PLATFORM_COLOR.kick;
    return (
      <Flex align="center" gap="9px" minW="0" flex="1">
        <PlatformIcon platform="kick" size={13} color={pc} />
        <Text fontSize="13px" color="text" lineClamp={1} minW="0">
          <chakra.span fontWeight="700" color={pc}>
            {item.user}
          </chakra.span>{" "}
          subscribed{item.months > 1 ? ` · ${item.months} months` : ""}
        </Text>
      </Flex>
    );
  }

  // announcement
  const color = item.color || TW;
  return (
    <Flex align="center" gap="10px" minW="0" flex="1">
      <Box as="span" display="inline-flex" flex="none" color={TW}>
        <MegaphoneIcon />
      </Box>
      <PlatformIcon platform="twitch" size={12} color={TW} />
      <Text fontWeight="600" fontSize="13px" color={color} flex="none">
        {item.user}
      </Text>
      <Text fontSize="13px" color="text" lineClamp={1} minW="0">
        {item.text}
      </Text>
    </Flex>
  );
}

function IconButton({ children, label, onClick }: { children: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <chakra.button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      w="22px"
      h="22px"
      borderRadius="4px"
      display="inline-flex"
      alignItems="center"
      justifyContent="center"
      color="faint"
      cursor="pointer"
      _hover={{ color: "text", bg: "raised" }}
    >
      {children}
    </chakra.button>
  );
}

function Chevron({ up }: { up: boolean }) {
  return (
    <Box as="span" display="inline-flex" transform={up ? "none" : "rotate(180deg)"} transition="transform .15s">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path d="M5 15l7-7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </Box>
  );
}

function XIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" aria-hidden>
      <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

function PinIcon({ size = 13 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M16 3v2h-1v6l2 2v2h-4.2v5l-.8 1-.8-1v-5H7v-2l2-2V5H8V3z" />
    </svg>
  );
}

function MegaphoneIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M4 9v6h3l7 4V5L7 9H4zm12.5 3a4.5 4.5 0 0 0-2-3.7v7.4a4.5 4.5 0 0 0 2-3.7z" />
    </svg>
  );
}

function RaidIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 2l2.4 4.9 5.4.8-3.9 3.8.9 5.4-4.8-2.5-4.8 2.5.9-5.4L4.2 7.7l5.4-.8z" />
    </svg>
  );
}

function GiftIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M20 7h-2.2a3 3 0 0 0-4.3-3.9L12 4.2l-1.5-1.1A3 3 0 0 0 6.2 7H4a1 1 0 0 0-1 1v3h1v9a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-9h1V8a1 1 0 0 0-1-1zm-5.2-2.4a1 1 0 0 1 1.2 1.5L15 7h-1.6zM11 20H6v-9h5zm0-11H5V9h6zm2 11h-1v-9h1zm6 0h-5v-9h5zm1-11h-6V9h6z" />
    </svg>
  );
}

function TrainIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 2c-4 0-7 .5-7 4v7a3 3 0 0 0 3 3l-1.5 2v.5h11V18L16 16a3 3 0 0 0 3-3V6c0-3.5-3-4-7-4zM8.5 14A1.5 1.5 0 1 1 10 12.5 1.5 1.5 0 0 1 8.5 14zm7 0a1.5 1.5 0 1 1 1.5-1.5 1.5 1.5 0 0 1-1.5 1.5zM17 9H7V6.5C7 5 9 5 12 5s5 0 5 1.5z" />
    </svg>
  );
}
