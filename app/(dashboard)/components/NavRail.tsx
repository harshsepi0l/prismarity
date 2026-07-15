"use client";

import NextLink from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Flex, Box, Text, chakra } from "@chakra-ui/react";
import { useLayout, NAV_COLLAPSE_AT } from "../_ctx/layout";
import { useChat } from "../_ctx/chat";
import { useSession } from "../_ctx/session";
import { ResizeHandle } from "./ResizeHandle";
import { PlatformIcon, PLATFORM_COLOR } from "./PlatformIcon";
import type { SearchResult } from "../types";

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
  const { selectSearchResult, addWatchedChannel } = useChat();
  const { activeFilters } = useSession();
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

  function handleSelect(r: SearchResult) {
    selectSearchResult(r);
    addWatchedChannel(r);
    setOpen(false);
    setQuery("");
  }

  function openSearch() {
    setOpen(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  if (collapsed) {
    return (
      <Box w="100%" h="34px" position="relative">
        <chakra.button
          type="button" onClick={openSearch}
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
                    {r.twitch && twitchOn && <PlatformIcon platform="twitch" size={13} />}
                    {r.kick && kickOn && <PlatformIcon platform="kick" size={13} />}
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

function OwnChannelButton({
  platform,
  name,
  isLive,
  viewers,
  active,
  collapsed,
  onClick,
}: {
  platform: "twitch" | "kick";
  name: string;
  isLive: boolean;
  viewers?: number;
  active: boolean;
  collapsed: boolean;
  onClick: () => void;
}) {
  const color = PLATFORM_COLOR[platform];

  if (collapsed) {
    return (
      <Box w="100%" h="34px" position="relative">
        <chakra.button
          type="button" onClick={onClick}
          position="absolute" top="0" left="calc(50% - 17px)"
          display="flex" alignItems="center" justifyContent="center"
          w="34px" h="34px" borderRadius="8px"
          bg={active ? "raised" : "transparent"}
          cursor="pointer" title={name}
          transition="background .12s"
          _hover={{ bg: "raised" }}
        >
          <Box position="relative">
            <PlatformIcon platform={platform} color={active ? color : "#5C6479"} size={16} />
            {isLive && (
              <Box
                position="absolute" bottom="-2px" right="-2px"
                w="6px" h="6px" borderRadius="full" bg="#FF5C5C"
                borderWidth="1.5px" borderColor="bg"
              />
            )}
          </Box>
        </chakra.button>
      </Box>
    );
  }

  return (
    <chakra.button
      type="button" onClick={onClick}
      display="flex" alignItems="center" gap="9px"
      w="100%" pl="6px" pr="8px" py="6px" borderRadius="8px"
      bg={active ? "raised" : "transparent"}
      cursor="pointer"
      transition="background .12s, color .12s"
      _hover={{ bg: "raised" }}
    >
      {/* Platform identity edge */}
      <Box
        w="3px" alignSelf="stretch" borderRadius="full" flex="none"
        style={{ background: color, opacity: active ? 1 : 0.35 }}
        transition="opacity .12s"
      />
      <Box position="relative" flex="none">
        <PlatformIcon platform={platform} color={active ? color : "#5C6479"} size={15} />
        {isLive && (
          <Box
            position="absolute" bottom="-2px" right="-2px"
            w="5px" h="5px" borderRadius="full" bg="#FF5C5C"
            borderWidth="1px" borderColor="bg"
          />
        )}
      </Box>
      <Text flex="1" minW="0" fontSize="13px" fontWeight={active ? "500" : "400"} color={active ? "text" : "muted"} textAlign="left" truncate>
        {name}
      </Text>
      {isLive ? (
        <Flex align="center" gap="4px" flex="none">
          <Text fontFamily="mono" fontSize="11px" color="muted">
            {viewers != null ? viewers.toLocaleString() : ""}
          </Text>
        </Flex>
      ) : (
        <Text fontFamily="mono" fontSize="10px" color="faint" flex="none">offline</Text>
      )}
    </chakra.button>
  );
}

// ── Watched channel button ───────────────────────────────────────────────────

function WatchedChannelButton({
  result, active, collapsed, onSelect, onRemove,
}: {
  result: SearchResult;
  active: boolean;
  collapsed: boolean;
  onSelect: () => void;
  onRemove: () => void;
}) {
  const isLive = result.twitch?.isLive || result.kick?.isLive;
  const avatar = result.profileImageUrl;
  const initial = result.displayName[0]?.toUpperCase() ?? "?";

  // Platform identity edge — solid for one platform, gradient when the
  // channel spans both.
  const edge =
    result.twitch && result.kick
      ? `linear-gradient(${PLATFORM_COLOR.twitch}, ${PLATFORM_COLOR.kick})`
      : result.twitch
        ? PLATFORM_COLOR.twitch
        : PLATFORM_COLOR.kick;

  const Avatar = (
    <Box position="relative" flex="none" w="22px" h="22px">
      {avatar ? (
        <chakra.img src={avatar} alt={result.displayName} w="22px" h="22px" borderRadius="full" objectFit="cover" />
      ) : (
        <Flex w="22px" h="22px" borderRadius="full" bg="raised" align="center" justify="center" fontSize="9px" fontWeight="700" color="muted">
          {initial}
        </Flex>
      )}
      {isLive && (
        <Box position="absolute" bottom="-1px" right="-1px" w="6px" h="6px" borderRadius="full" bg="#FF5C5C" borderWidth="1.5px" borderColor="bg" />
      )}
    </Box>
  );

  if (!collapsed) {
    return (
      <Box position="relative" role="group">
        <chakra.button
          type="button" onClick={onSelect}
          display="flex" alignItems="center" justifyContent="flex-start"
          gap="8px" w="100%" pl="6px" py="5px" pr="28px"
          borderRadius="8px" bg={active ? "raised" : "transparent"} color={active ? "text" : "muted"}
          cursor="pointer" transition="background .12s, color .12s"
          _hover={{ bg: "raised", color: "text" }}
        >
          <Box
            w="3px" alignSelf="stretch" borderRadius="full" flex="none"
            style={{ background: edge, opacity: active ? 1 : 0.35 }}
            transition="opacity .12s"
          />
          {Avatar}
          <Text flex="1" minW="0" fontSize="12px" textAlign="left" truncate>{result.displayName}</Text>
          {isLive ? (
            <Box w="5px" h="5px" borderRadius="full" bg="#FF5C5C" flex="none" />
          ) : (
            <Text fontFamily="mono" fontSize="10px" color="faint" flex="none">offline</Text>
          )}
        </chakra.button>
        <chakra.button
          type="button"
          onClick={(e: React.MouseEvent) => { e.stopPropagation(); onRemove(); }}
          title="Remove channel"
          position="absolute" right="6px" top="50%" transform="translateY(-50%)"
          display="flex" alignItems="center" justifyContent="center"
          w="16px" h="16px" borderRadius="3px"
          fontSize="10px" fontWeight="700"
          color="faint" cursor="pointer"
          opacity="0"
          transition="opacity .12s, color .12s, background .12s"
          _groupHover={{ opacity: 1 }}
          _hover={{ color: "text", bg: "raised" }}
        >✕</chakra.button>
      </Box>
    );
  }

  return (
    <Box w="100%" h="34px" position="relative">
      <chakra.button
        type="button" onClick={onSelect}
        position="absolute" top="0" left="calc(50% - 17px)"
        display="flex" alignItems="center" gap="8px"
        pl="6px" pr="10px" h="34px"
        borderRadius="20px" maxW="34px" overflow="hidden" whiteSpace="nowrap"
        bg={active ? "raised" : "transparent"} color={active ? "text" : "muted"}
        cursor="pointer"
        transition="max-width 0.4s ease, background .12s, color .12s"
        _hover={{ bg: "raised", color: "text", maxW: "300px" }}
      >
        {Avatar}
        <Text flex="none" fontSize="12px">{result.displayName}</Text>
        {isLive && <Box flex="none" w="5px" h="5px" borderRadius="full" bg="#FF5C5C" />}
      </chakra.button>
    </Box>
  );
}

// ── Section label ────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <Text
      fontFamily="mono" fontSize="9px" letterSpacing="0.18em"
      color="faint" px="10px" pb="6px"
    >
      {children}
    </Text>
  );
}

// ── Main NavRail ─────────────────────────────────────────────────────────────

export function NavRail() {
  const pathname = usePathname();
  const { navWidth, setNavWidth } = useLayout();
  const {
    ownChannel, ownKick,
    activeChannel, activeKickOnly,
    watchedChannels,
    selectChannel, selectKickOnly, selectSearchResult,
    clearSelection, removeWatchedChannel,
  } = useChat();

  const collapsed = navWidth > 0 && navWidth < NAV_COLLAPSE_AT;
  const vodsActive = pathname === "/vods";

  const ownTwitchActive = !!ownChannel && activeChannel?.id === ownChannel.id;
  const ownKickActive = !!ownKick && activeKickOnly === ownKick.slug.toLowerCase();

  const hasOwnChannels = !!ownChannel || !!ownKick;

  return (
    <Flex
      as="nav"
      position="relative"
      flex="none"
      w={`${navWidth}px`}
      direction="column"
      borderRightWidth={navWidth > 0 ? "1px" : "0"}
      borderColor="line"
      px={collapsed ? "8px" : "12px"}
      py={navWidth > 0 ? "20px" : "0"}
      gap="0"
      style={{
        overflow: navWidth < NAV_COLLAPSE_AT ? "visible" : "hidden",
        pointerEvents: navWidth === 0 ? "none" : undefined,
      }}
    >
      {navWidth > 0 && (
        <>
          {/* Own channels — pinned */}
          {hasOwnChannels && (
            <Box mb="18px">
              {!collapsed && <SectionLabel>YOUR CHANNELS</SectionLabel>}
              <Flex direction="column" gap="2px" align={collapsed ? "center" : "stretch"}>
                {ownChannel && (
                  <OwnChannelButton
                    platform="twitch"
                    name={ownChannel.displayName}
                    isLive={ownChannel.isLive}
                    viewers={ownChannel.viewerCount}
                    active={ownTwitchActive}
                    collapsed={collapsed}
                    onClick={() => selectChannel(ownChannel)}
                  />
                )}
                {ownKick && (
                  <OwnChannelButton
                    platform="kick"
                    name={ownKick.slug}
                    isLive={ownKick.isLive}
                    viewers={ownKick.viewers}
                    active={ownKickActive}
                    collapsed={collapsed}
                    onClick={() => selectKickOnly(ownKick.slug)}
                  />
                )}
              </Flex>
            </Box>
          )}

          {/* Watched channels */}
          {watchedChannels.length > 0 && (
            <Box mb="12px">
              {!collapsed && <SectionLabel>WATCHING</SectionLabel>}
              <Flex direction="column" gap="2px" align={collapsed ? "center" : "stretch"}>
                {watchedChannels.map((result) => {
                  const active =
                    (!!result.twitch && activeChannel?.id === result.twitch.id) ||
                    (!!result.kick && activeKickOnly === result.kick.slug.toLowerCase());
                  return (
                    <WatchedChannelButton
                      key={result.handle}
                      result={result}
                      active={active}
                      collapsed={collapsed}
                      onSelect={() => selectSearchResult(result)}
                      onRemove={() => {
                        if (active) {
                          const idx = watchedChannels.findIndex((c) => c.handle === result.handle);
                          const prev = idx > 0 ? watchedChannels[idx - 1] : null;
                          if (prev) selectSearchResult(prev);
                          else clearSelection();
                        }
                        removeWatchedChannel(result.handle);
                      }}
                    />
                  );
                })}
              </Flex>
            </Box>
          )}

          {/* Add channel search */}
          <Box mb="4px">
            <SidebarSearch collapsed={collapsed} />
          </Box>

          <Box flex="1" minH="16px" />

          {/* VODs link */}
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
        </>
      )}

      <ResizeHandle side="right" width={navWidth} onResize={setNavWidth} />
    </Flex>
  );
}
