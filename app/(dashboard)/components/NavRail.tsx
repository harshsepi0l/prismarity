"use client";

import NextLink from "next/link";
import { usePathname } from "next/navigation";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Flex, Box, Text, chakra } from "@chakra-ui/react";
import { useLayout, NAV_RAIL_WIDTH } from "../_ctx/layout";
import { useChat } from "../_ctx/chat";
import { useSession } from "../_ctx/session";
import { ResizeHandle } from "./ResizeHandle";
import { PlatformIcon, PLATFORM_COLOR } from "./PlatformIcon";
import { SectionLabel } from "./ui";
import { useYouTubePresence } from "../_hooks/useYouTubePresence";
import { useTwitchCategories } from "../_hooks/useTwitchCategories";
import type { SearchResult } from "../types";

// Retro "now playing" plate — a solid toned-down goldenrod badge (black border,
// hard drop shadow) that sits on its own line under the streamer's name. The
// category text crawls within the plate (breaking-news style) only when it
// overflows its capped width; short names hug the badge and sit still. Width is
// fit-content up to 100%: a neat pill for short games, a ticker for long.
const PLATE_INK = "#0B0B0B";
const PLATE_BG = "#CBA23C"; // toned-down goldenrod — solid, no gradient

function NowPlayingPlate({ game }: { game: string }) {
  const outerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLSpanElement>(null);
  const [shift, setShift] = useState(0);
  const label = `Playing — ${game}`;

  useEffect(() => {
    const outer = outerRef.current;
    const inner = innerRef.current;
    if (!outer || !inner) return;
    const over = Math.ceil(inner.scrollWidth - outer.clientWidth);
    setShift(over > 2 ? over : 0);
  }, [label]);

  // ~22px/sec crawl, floored so short overflows still read as deliberate.
  const dur = Math.max(4, shift / 22);
  const animStyle: React.CSSProperties =
    shift > 0
      ? ({ "--tkr": `-${shift}px`, animation: `nav-ticker ${dur}s ease-in-out infinite alternate` } as React.CSSProperties)
      : {};

  return (
    <Box
      display="inline-flex"
      alignItems="center"
      w="fit-content"
      minW="0"
      maxW="100%"
      h="18px"
      px="8px"
      borderWidth="1.5px"
      borderColor={PLATE_INK}
      borderRadius="5px"
      style={{
        background: PLATE_BG,
        boxShadow: "2px 2px 0 rgba(0,0,0,0.5)",
      }}
    >
      <Box ref={outerRef} overflow="hidden" minW="0" maxW="100%">
        <chakra.span
          ref={innerRef}
          display="inline-block"
          whiteSpace="nowrap"
          fontFamily="mono"
          fontSize="10px"
          fontWeight="700"
          letterSpacing="0.02em"
          style={{ color: PLATE_INK, ...animStyle }}
        >
          {label}
        </chakra.span>
      </Box>
    </Box>
  );
}

// White L-connector: drops from under the streamer avatar and turns right into
// the "now playing" plate on the line below, so the badge reads as hanging off
// the pfp. Rendered as the first child of the plate line, aligned under the pfp.
function PlateElbow() {
  return (
    <Box
      flex="none"
      w="13px" h="11px"
      mt="-4px" mr="4px"
      borderLeftWidth="2px" borderBottomWidth="2px"
      borderColor="white"
      borderBottomLeftRadius="4px"
    />
  );
}

// Live-platform ring for the avatar — the single source of "live" now that the
// edge bar and red dots are gone. Solid in the one platform's colour; split into
// EQUAL conic wedges when a streamer is live on several at once. Grey when offline
// so every avatar keeps the same footprint and the colour simply lights up.
const OFFLINE_RING = "#2a3140";
const RING_GAP = "#0E1118"; // == bg token: a crisp inset between ring and pfp

function ringPaint(liveColors: string[]): string {
  if (liveColors.length === 0) return OFFLINE_RING;
  if (liveColors.length === 1) return liveColors[0];
  const n = liveColors.length;
  const stops = liveColors
    .map((c, i) => `${c} ${(i / n) * 360}deg ${((i + 1) / n) * 360}deg`)
    .join(", ");
  return `conic-gradient(from -90deg, ${stops})`;
}

function RingedAvatar({ src, label, size, ring }: {
  src: string | null;
  label: string;
  size: number;
  ring: string;
}) {
  const outer = size + 6;
  const gap = { boxShadow: `0 0 0 1.5px ${RING_GAP}` } as React.CSSProperties;
  return (
    <Box
      position="relative" flex="none"
      w={`${outer}px`} h={`${outer}px`} borderRadius="full"
      display="flex" alignItems="center" justifyContent="center"
      style={{ background: ring }}
    >
      {src ? (
        <chakra.img
          src={src} alt={label} w={`${size}px`} h={`${size}px`}
          borderRadius="full" objectFit="cover" style={gap}
        />
      ) : (
        <Flex
          w={`${size}px`} h={`${size}px`} borderRadius="full" bg="raised"
          align="center" justify="center" fontSize="9px" fontWeight="700" color="muted"
          style={gap}
        >
          {label[0]?.toUpperCase() ?? "?"}
        </Flex>
      )}
    </Box>
  );
}

const VODS_ICON = (
  <Box
    w="0" h="0" flex="none" ml="3px"
    borderLeft="12px solid currentColor"
    borderTop="7px solid transparent"
    borderBottom="7px solid transparent"
  />
);

// ── Inline sidebar search ────────────────────────────────────────────────────

function SidebarSearch({ collapsed }: { collapsed: boolean }) {
  const { selectSearchResult, addWatchedChannel, followedChannels, ownChannel, ownKick } = useChat();
  const { activeFilters } = useSession();
  const { setSearchOpen } = useLayout();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const q = query.trim();
    let cancelled = false;
    /* eslint-disable react-hooks/set-state-in-effect */
    if (!q) { setResults([]); setSearching(false); return; }
    setSearching(true);
    /* eslint-enable react-hooks/set-state-in-effect */
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
        const json = (await res.json()) as { results?: SearchResult[] };
        if (!cancelled) setResults(json.results ?? []);
      } catch {
        if (!cancelled) setResults([]);
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 350);
    return () => { cancelled = true; clearTimeout(t); };
  }, [query]);

  const twitchOn = activeFilters.has("twitch");
  const kickOn = activeFilters.has("kick");
  const visible = results.filter((r) => (r.twitch && twitchOn) || (r.kick && kickOn));
  // YouTube existence (do they have a YouTube linked) for a third badge — no
  // live scrape here, just the socials lookup.
  const ytPresence = useYouTubePresence(visible.map((r) => r.handle));

  function handleSelect(r: SearchResult) {
    selectSearchResult(r);
    // Only track it under RECENT if it isn't already one of your own channels
    // or something you follow — no duplicates across sections.
    const isOwn =
      (!!ownChannel && r.twitch?.id === ownChannel.id) ||
      (!!ownKick && r.kick?.slug.toLowerCase() === ownKick.slug.toLowerCase());
    const isFollowed = followedChannels.some((c) => c.handle === r.handle);
    if (!isOwn && !isFollowed) addWatchedChannel(r);
    setOpen(false);
    setQuery("");
  }

  function openSearch() {
    setOpen(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  // Collapsed rail has no room for the inline field — the icon opens the shared
  // ⌘K CommandSearch overlay instead (fixes the dead collapsed-search path).
  if (collapsed) {
    return (
      <Box w="100%" h="34px" position="relative">
        <chakra.button
          type="button" onClick={() => setSearchOpen(true)}
          position="absolute" top="0" left="calc(50% - 17px)"
          display="flex" alignItems="center" justifyContent="center"
          w="34px" h="34px" borderRadius="8px"
          color="faint" cursor="pointer"
          transition="color .12s, background .12s"
          _hover={{ color: "muted", bg: "raised" }}
          title="Add channel"
        >
          <svg width="14" height="14" viewBox="0 0 20 20" fill="none" aria-hidden>
            <circle cx="9" cy="9" r="6.5" stroke="currentColor" strokeWidth="1.6" />
            <path d="M14 14 L18 18" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </chakra.button>
      </Box>
    );
  }

  if (!open) {
    return (
      <chakra.button
        type="button" onClick={openSearch}
        display="flex" alignItems="center" gap="8px"
        w="100%" px="8px" py="5px" borderRadius="8px"
        color="faint" cursor="pointer" fontSize="12px"
        transition="color .12s, background .12s"
        _hover={{ color: "muted", bg: "raised" }}
      >
        <svg width="13" height="13" viewBox="0 0 20 20" fill="none" aria-hidden>
          <circle cx="9" cy="9" r="6.5" stroke="currentColor" strokeWidth="1.6" />
          <path d="M14 14 L18 18" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
        Add channel
      </chakra.button>
    );
  }

  return (
    <Box position="relative">
      <Flex
        align="center" gap="7px"
        bg="field" borderWidth="1px" borderColor="fieldLine"
        borderRadius="8px" px="8px" h="30px"
      >
        <svg width="12" height="12" viewBox="0 0 20 20" fill="none" aria-hidden>
          <circle cx="9" cy="9" r="6.5" stroke="#8B93A7" strokeWidth="1.6" />
          <path d="M14 14 L18 18" stroke="#8B93A7" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
        <chakra.input
          ref={inputRef}
          flex="1"
          minW="0"
          fontSize="12px"
          color="text"
          bg="transparent"
          border="none"
          outline="none"
          value={query}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setQuery(e.target.value)}
          onBlur={() => { if (!query.trim()) { setOpen(false); } }}
          placeholder="Search…"
          _placeholder={{ color: "faint" }}
        />
        <chakra.button
          type="button"
          onClick={() => { setOpen(false); setQuery(""); }}
          color="faint" cursor="pointer" fontSize="11px"
          _hover={{ color: "muted" }}
        >✕</chakra.button>
      </Flex>

      {(searching || visible.length > 0) && (
        <Box
          position="absolute" top="calc(100% + 4px)" left="0" right="0"
          bg="panel" borderWidth="1px" borderColor="line" borderRadius="10px"
          boxShadow="0 12px 36px rgba(0,0,0,0.5)"
          zIndex={30} py="4px" maxH="280px" overflowY="auto"
        >
          {searching ? (
            <Text fontSize="12px" color="faint" px="10px" py="8px">Searching…</Text>
          ) : (
            visible.map((r) => {
              const isLive = r.twitch?.isLive || r.kick?.isLive;
              return (
                <chakra.button
                  key={r.handle}
                  type="button"
                  onMouseDown={(e: React.MouseEvent) => { e.preventDefault(); handleSelect(r); }}
                  display="flex" alignItems="center" gap="9px"
                  w="100%" px="10px" py="8px"
                  cursor="pointer" color="muted"
                  transition="background .1s, color .1s"
                  _hover={{ bg: "raised", color: "text" }}
                >
                  <Flex align="center" gap="3px" flex="none">
                    {/* Existence badges — one per platform the streamer is on. */}
                    {r.twitch && twitchOn && <PlatformIcon platform="twitch" size={13} />}
                    {r.kick && kickOn && <PlatformIcon platform="kick" size={13} />}
                    {ytPresence[r.handle]?.url && <PlatformIcon platform="youtube" size={13} />}
                  </Flex>
                  <Text flex="1" minW="0" fontSize="12px" textAlign="left" truncate>{r.displayName}</Text>
                  {isLive && <Box w="5px" h="5px" borderRadius="full" bg="#FF5C5C" flex="none" />}
                </chakra.button>
              );
            })
          )}
        </Box>
      )}
    </Box>
  );
}

// ── Own channel button ───────────────────────────────────────────────────────

const OwnChannelButton = memo(function OwnChannelButton({
  platform,
  name,
  avatar,
  isLive,
  viewers,
  active,
  collapsed,
  category,
  onClick,
}: {
  platform: "twitch" | "kick";
  name: string;
  avatar: string | null;
  isLive: boolean;
  viewers?: number;
  active: boolean;
  collapsed: boolean;
  category?: string; // "now playing" category, when live
  onClick: () => void;
}) {
  const color = PLATFORM_COLOR[platform];
  const ticker = isLive && !!category;

  // Avatar ring is the live indicator: platform colour when live, grey when off.
  const size = collapsed ? 24 : 22;
  const AvatarEl = (
    <RingedAvatar src={avatar} label={name} size={size} ring={ringPaint(isLive ? [color] : [])} />
  );

  if (collapsed) {
    // Same hover-expand pill as watched channels: icon-only until hovered, then
    // slides open to reveal the name (and viewers when live).
    return (
      <Box w="100%" h="34px" position="relative">
        <chakra.button
          type="button" onClick={onClick}
          position="absolute" top="0" left="calc(50% - 17px)"
          display="flex" alignItems="center" gap="8px"
          pl="3px" pr="12px" h="34px"
          borderRadius="18px" maxW="34px" overflow="hidden" whiteSpace="nowrap"
          bg={active ? "raised" : "transparent"} color={active ? "text" : "muted"}
          cursor="pointer" title={name}
          transition="max-width 0.4s ease, background .12s, color .12s"
          _hover={{ bg: "raised", color: "text", maxW: "360px", zIndex: 6 }}
        >
          {AvatarEl}
          <Text flex="none" fontSize="12px" fontWeight="700" color="text">{name}</Text>
          {/* Collapsed: plate inline to the right of the pfp/name. */}
          {ticker && <NowPlayingPlate game={category!} />}
          {isLive && viewers != null && (
            <Text flex="none" fontFamily="mono" fontSize="10px" color="muted">
              {viewers.toLocaleString()}
            </Text>
          )}
        </chakra.button>
      </Box>
    );
  }

  return (
    <chakra.button
      type="button" onClick={onClick}
      display="flex" flexDirection="column" justifyContent="center" gap="0"
      w="100%" pl="6px" pr="8px" py="7px" borderRadius="8px"
      bg={active ? "raised" : "transparent"}
      cursor="pointer"
      transition="background .12s, color .12s"
      _hover={{ bg: "raised", "& [data-name]": { color: "text", fontWeight: "700" } }}
    >
      {/* Name line — avatar ring carries "live"; no bar, no dot. */}
      <Flex align="center" gap="9px" minW="0" w="100%">
        {AvatarEl}
        <Text
          data-name flex="1" minW="0" fontSize="13px"
          fontWeight={active || isLive ? "700" : "500"}
          color={active || isLive ? "text" : "muted"} textAlign="left" truncate
        >
          {name}
        </Text>
        {isLive ? (
          <Text fontFamily="mono" fontSize="11px" color="muted" flex="none">
            {viewers != null ? viewers.toLocaleString() : ""}
          </Text>
        ) : (
          <Text fontFamily="mono" fontSize="10px" color="faint" flex="none">offline</Text>
        )}
      </Flex>
      {/* Plate line — white elbow drops from under the pfp into the plate. */}
      {ticker && (
        <Flex align="center" mt="4px" pl="13px" minW="0" maxW="100%">
          <PlateElbow />
          <NowPlayingPlate game={category!} />
        </Flex>
      )}
    </chakra.button>
  );
});

// ── Watched channel button ───────────────────────────────────────────────────

// memo'd so it skips re-render on every chat message (NavRail re-renders via
// context, but these keep the same props). Handlers take the result so callers
// pass STABLE context callbacks instead of per-render closures.
const WatchedChannelButton = memo(function WatchedChannelButton({
  result, active, collapsed, youtubeLive, category, onSelect, onRemove,
}: {
  result: SearchResult;
  active: boolean;
  collapsed: boolean;
  youtubeLive?: boolean; // live on their YouTube (from Twitch socials + scrape)
  category?: string; // Twitch "now playing" category, when live
  onSelect: (result: SearchResult) => void;
  onRemove?: (result: SearchResult) => void; // omitted for followed channels (not removable)
}) {
  const avatar = result.profileImageUrl;

  // The avatar ring is the live indicator — one platform's colour, or EQUAL conic
  // wedges when live on several at once (purple Twitch, green Kick, red YouTube);
  // grey when offline everywhere.
  const liveTwitch = !!result.twitch?.isLive;
  const liveKick = !!result.kick?.isLive;
  const liveYoutube = !!youtubeLive;
  const isLive = liveTwitch || liveKick || liveYoutube;
  const ticker = isLive && !!category;
  const liveColors = [
    liveTwitch ? PLATFORM_COLOR.twitch : null,
    liveKick ? PLATFORM_COLOR.kick : null,
    liveYoutube ? PLATFORM_COLOR.youtube : null,
  ].filter((c): c is string => !!c);
  const size = collapsed ? 24 : 22;
  const Avatar = (
    <RingedAvatar src={avatar} label={result.displayName} size={size} ring={ringPaint(liveColors)} />
  );

  if (!collapsed) {
    return (
      <Box position="relative" role="group">
        <chakra.button
          type="button" onClick={() => onSelect(result)}
          display="flex" flexDirection="column" justifyContent="center"
          gap="0" w="100%" pl="6px" py="7px" pr="28px"
          borderRadius="8px" bg={active ? "raised" : "transparent"} color={active ? "text" : "muted"}
          cursor="pointer" transition="background .12s, color .12s"
          _hover={{ bg: "raised", color: "text", "& [data-name]": { color: "text", fontWeight: "700" } }}
        >
          {/* Name line — avatar ring carries "live"; no bar, no dot. */}
          <Flex align="center" gap="8px" minW="0" w="100%">
            {Avatar}
            <Text data-name flex="1" minW="0" fontSize="12px" fontWeight={active || isLive ? "700" : "500"} color={active || isLive ? "text" : "muted"} textAlign="left" truncate>{result.displayName}</Text>
            {!isLive && (
              <Text fontFamily="mono" fontSize="10px" color="faint" flex="none">offline</Text>
            )}
          </Flex>
          {/* Plate line — white elbow drops from under the pfp into the plate. */}
          {ticker && (
            <Flex align="center" mt="4px" pl="13px" minW="0" maxW="100%">
              <PlateElbow />
              <NowPlayingPlate game={category!} />
            </Flex>
          )}
        </chakra.button>
        {onRemove && (
          <chakra.button
            type="button"
            onClick={(e: React.MouseEvent) => { e.stopPropagation(); onRemove(result); }}
            title="Remove channel"
            position="absolute" right="6px" top="50%" transform="translateY(-50%)"
            display="flex" alignItems="center" justifyContent="center"
            w="16px" h="16px" borderRadius="3px"
            fontSize="10px" fontWeight="700"
            color="faint" cursor="pointer"
            opacity="0.45"
            transition="opacity .12s, color .12s, background .12s"
            _hover={{ opacity: 1, color: "text", bg: "raised" }}
          >✕</chakra.button>
        )}
      </Box>
    );
  }

  return (
    <Box w="100%" h="34px" position="relative">
      <chakra.button
        type="button" onClick={() => onSelect(result)}
        position="absolute" top="0" left="calc(50% - 17px)"
        display="flex" alignItems="center" gap="8px"
        pl="3px" pr="10px" h="34px"
        borderRadius="18px" maxW="34px" overflow="hidden" whiteSpace="nowrap"
        bg={active ? "raised" : "transparent"} color={active ? "text" : "muted"}
        cursor="pointer"
        transition="max-width 0.4s ease, background .12s, color .12s"
        _hover={{ bg: "raised", color: "text", maxW: "360px", zIndex: 6 }}
      >
        {Avatar}
        <Text flex="none" fontSize="12px" fontWeight="700" color="text">{result.displayName}</Text>
        {/* Collapsed: plate inline to the right of the pfp/name, revealed as the
            pill expands on hover. */}
        {ticker && <NowPlayingPlate game={category!} />}
      </chakra.button>
    </Box>
  );
});

// ── Main NavRail ─────────────────────────────────────────────────────────────

export function NavRail() {
  const pathname = usePathname();
  const { navWidth, setNavWidth, isMobile, navOpen, setNavOpen, navMode } = useLayout();
  const {
    ownChannel, ownKick,
    activeChannel, activeKickOnly,
    watchedChannels, followedChannels,
    selectChannel, selectKickOnly, selectSearchResult,
    clearSelection, removeWatchedChannel,
  } = useChat();

  // A channel you already follow shouldn't also appear under RECENT.
  const followedHandles = useMemo(
    () => new Set(followedChannels.map((c) => c.handle)),
    [followedChannels]
  );
  const visibleWatched = useMemo(
    () => watchedChannels.filter((c) => !followedHandles.has(c.handle)),
    [watchedChannels, followedHandles]
  );

  // FOLLOWED is API-sorted (most viewers → offline); paginate it 10 at a time.
  const [followedShown, setFollowedShown] = useState(10);
  const followedVisible = useMemo(
    () => followedChannels.slice(0, followedShown),
    [followedChannels, followedShown]
  );
  const followedMore = followedChannels.length - followedShown;

  // YouTube live status for the visible sidebar channels — resolved from each
  // streamer's Twitch socials (YouTube link) + a live scrape, so the edge bar
  // can light up red when they're live on YouTube. Only the visible rows are
  // checked (the scrape is heavy); server-cached.
  const sidebarLogins = useMemo(
    () => [...followedVisible, ...visibleWatched].map((r) => r.handle),
    [followedVisible, visibleWatched]
  );
  const ytLive = useYouTubePresence(sidebarLogins, { live: true });

  // "Now playing" categories for the visible Twitch channels (own included) —
  // one bulk Get Streams call, keyed by lowercased login (== handle).
  const categoryLogins = useMemo(() => {
    const arr = [...followedVisible, ...visibleWatched].map((r) => r.handle);
    if (ownChannel) arr.push(ownChannel.login.toLowerCase());
    return arr;
  }, [followedVisible, visibleWatched, ownChannel]);
  const categories = useTwitchCategories(categoryLogins);

  // Followed/Recent load from client-only state after mount, so they never SSR.
  // The own-channel row is the one exception (it derives from server props), so
  // it WOULD hydrate — and any Emotion className drift there shows up as a
  // mismatch. Gate the whole channel list on mount so no row is server-rendered;
  // the list is then purely client-side and there's nothing to hydrate.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Stable handlers so the memo'd channel buttons keep the same props across the
  // NavRail re-renders that the chat context triggers on every message.
  const selectOwnTwitch = useCallback(() => {
    if (ownChannel) selectChannel(ownChannel);
  }, [ownChannel, selectChannel]);
  const selectOwnKick = useCallback(() => {
    if (ownKick) selectKickOnly(ownKick.slug);
  }, [ownKick, selectKickOnly]);
  const handleRemoveWatched = useCallback(
    (result: SearchResult) => {
      const isActive =
        (!!result.twitch && activeChannel?.id === result.twitch.id) ||
        (!!result.kick && activeKickOnly === result.kick.slug.toLowerCase());
      if (isActive) {
        const idx = watchedChannels.findIndex((c) => c.handle === result.handle);
        const prev = idx > 0 ? watchedChannels[idx - 1] : null;
        if (prev) selectSearchResult(prev);
        else clearSelection();
      }
      removeWatchedChannel(result.handle);
    },
    [activeChannel, activeKickOnly, watchedChannels, selectSearchResult, clearSelection, removeWatchedChannel]
  );

  // Three user-cyclable modes: expanded (labels + resizable), rail (icon-only),
  // hidden. On mobile the rail is an overlay drawer that always shows full labels.
  const collapsed = !isMobile && navMode === "rail";
  const dockedWidth = isMobile
    ? 0
    : navMode === "hidden"
      ? 0
      : navMode === "rail"
        ? NAV_RAIL_WIDTH
        : navWidth;
  const vodsActive = pathname === "/vods";

  const ownTwitchActive = !!ownChannel && activeChannel?.id === ownChannel.id;
  const ownKickActive = !!ownKick && activeKickOnly === ownKick.slug.toLowerCase();

  const hasOwnChannels = !!ownChannel || !!ownKick;

  const content = (
    <>
          {/* Add channel — pinned to the top */}
          <Box mb="12px">
            <SidebarSearch collapsed={collapsed} />
          </Box>

          {/* Scrollable channel list (fixes desktop scroll: the docked rail
              itself is overflow-hidden, so the list scrolls here instead) */}
          <Box
            flex="1"
            minH="0"
            overflowY={collapsed ? "visible" : "auto"}
            overflowX={collapsed ? "visible" : "hidden"}
            pr={collapsed ? "0" : "2px"}
          >
          {/* Own channels */}
          {mounted && hasOwnChannels && (
            <Box mb="18px">
              {!collapsed && <SectionLabel>YOUR CHANNELS</SectionLabel>}
              <Flex direction="column" gap="2px" align={collapsed ? "center" : "stretch"}>
                {ownChannel && (
                  <OwnChannelButton
                    platform="twitch"
                    name={ownChannel.displayName}
                    avatar={ownChannel.profileImageUrl}
                    isLive={ownChannel.isLive}
                    viewers={ownChannel.viewerCount}
                    active={ownTwitchActive}
                    collapsed={collapsed}
                    category={categories[ownChannel.login.toLowerCase()]?.game}
                    onClick={selectOwnTwitch}
                  />
                )}
                {ownKick && (
                  <OwnChannelButton
                    platform="kick"
                    name={ownKick.slug}
                    avatar={ownKick.profileImageUrl}
                    isLive={ownKick.isLive}
                    viewers={ownKick.viewers}
                    active={ownKickActive}
                    collapsed={collapsed}
                    onClick={selectOwnKick}
                  />
                )}
              </Flex>
            </Box>
          )}

          {/* Followed channels — from Twitch, Kick-linked where present */}
          {mounted && followedChannels.length > 0 && (
            <Box mb="12px">
              {!collapsed && <SectionLabel>FOLLOWED</SectionLabel>}
              <Flex direction="column" gap="2px" align={collapsed ? "center" : "stretch"}>
                {followedVisible.map((result) => {
                  const active =
                    (!!result.twitch && activeChannel?.id === result.twitch.id) ||
                    (!!result.kick && activeKickOnly === result.kick.slug.toLowerCase());
                  return (
                    <WatchedChannelButton
                      key={`followed-${result.handle}`}
                      result={result}
                      active={active}
                      collapsed={collapsed}
                      youtubeLive={ytLive[result.handle]?.isLive}
                      category={categories[result.handle]?.game}
                      onSelect={selectSearchResult}
                    />
                  );
                })}
              </Flex>
              {!collapsed && (followedMore > 0 || followedShown > 10) && (
                <chakra.button
                  type="button"
                  onClick={() => setFollowedShown((n) => (followedMore > 0 ? n + 10 : 10))}
                  w="100%" mt="4px" py="4px" borderRadius="6px"
                  fontSize="11px" color="faint" cursor="pointer"
                  transition="color .12s, background .12s"
                  _hover={{ color: "muted", bg: "raised" }}
                >
                  {followedMore > 0 ? `Show ${Math.min(10, followedMore)} more` : "Show less"}
                </chakra.button>
              )}
            </Box>
          )}

          {/* Recent — channels you opened from search but don't follow */}
          {mounted && visibleWatched.length > 0 && (
            <Box mb="12px">
              {!collapsed && <SectionLabel>RECENT</SectionLabel>}
              <Flex direction="column" gap="2px" align={collapsed ? "center" : "stretch"}>
                {visibleWatched.map((result) => {
                  const active =
                    (!!result.twitch && activeChannel?.id === result.twitch.id) ||
                    (!!result.kick && activeKickOnly === result.kick.slug.toLowerCase());
                  return (
                    <WatchedChannelButton
                      key={result.handle}
                      result={result}
                      active={active}
                      collapsed={collapsed}
                      youtubeLive={ytLive[result.handle]?.isLive}
                      category={categories[result.handle]?.game}
                      onSelect={selectSearchResult}
                      onRemove={handleRemoveWatched}
                    />
                  );
                })}
              </Flex>
            </Box>
          )}

          </Box>{/* end scrollable channel list */}

          {/* VODs — pinned to the bottom */}
          <Box mt="10px">
          {!collapsed ? (
            <Flex
              asChild align="center" justify="flex-start" gap="12px"
              px="12px" py="9px" borderRadius="8px" fontSize="13px"
              fontWeight={vodsActive ? "500" : "400"}
              bg={vodsActive ? "raised" : "transparent"} color={vodsActive ? "text" : "muted"}
              transition="background .12s, color .12s" _hover={{ bg: "raised", color: "text" }}
            >
              <NextLink href="/vods">
                {VODS_ICON}
                <Box as="span" whiteSpace="nowrap">VODs</Box>
              </NextLink>
            </Flex>
          ) : (
            <Box w="100%" h="36px" position="relative">
              <Flex
                asChild align="center" gap="10px"
                position="absolute" top="0" left="calc(50% - 16px)"
                pl="8px" pr="12px" h="36px"
                borderRadius="20px" maxW="26px" overflow="hidden" whiteSpace="nowrap"
                fontSize="14px" fontWeight={vodsActive ? "500" : "400"}
                bg={vodsActive ? "raised" : "transparent"} color={vodsActive ? "text" : "muted"}
                transition="max-width 0.4s ease, background .12s, color .12s"
                _hover={{ bg: "raised", color: "text", maxW: "300px" }}
              >
                <NextLink href="/vods">
                  <Box flex="none" display="flex" alignItems="center">{VODS_ICON}</Box>
                  <Box as="span" flex="none">VODs</Box>
                </NextLink>
              </Flex>
            </Box>
          )}
          </Box>{/* end pinned VODs */}
    </>
  );

  // Mobile: off-canvas overlay drawer toggled from the TopBar hamburger.
  if (isMobile) {
    if (!navOpen) return null;
    return (
      <>
        <Box
          position="fixed" inset="0" zIndex={70} bg="rgba(0,0,0,0.55)"
          onClick={() => setNavOpen(false)}
        />
        <Flex
          as="nav"
          position="fixed" top="0" left="0" bottom="0" zIndex={71}
          w="min(280px, 82vw)" direction="column"
          bg="bg" borderRightWidth="1px" borderColor="line"
          px="12px" py="20px" gap="0" overflow="hidden"
        >
          {content}
        </Flex>
      </>
    );
  }

  // Desktop / tablet: docked rail. The tablet band auto-collapses to an icon
  // strip (fixed width, no resize handle).
  return (
    <Flex
      as="nav"
      position="relative"
      // Raise the rail above the chat when collapsed so the hover popouts, which
      // overflow into the chat area, paint on top of the chat content.
      zIndex={collapsed ? 25 : undefined}
      flex="none"
      w={`${dockedWidth}px`}
      direction="column"
      borderRightWidth={dockedWidth > 0 ? "1px" : "0"}
      borderColor="line"
      px={collapsed ? "8px" : "12px"}
      py={dockedWidth > 0 ? "20px" : "0"}
      gap="0"
      style={{
        overflow: collapsed ? "visible" : "hidden",
        pointerEvents: dockedWidth === 0 ? "none" : undefined,
      }}
    >
      {dockedWidth > 0 && content}

      {/* Drag-resize only in expanded mode, clamped to [min, max] by the context. */}
      {navMode === "expanded" && (
        <ResizeHandle side="right" width={navWidth} onResize={setNavWidth} />
      )}
    </Flex>
  );
}
