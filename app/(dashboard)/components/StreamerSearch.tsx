"use client";

import { useEffect, useState } from "react";
import { Box, Flex, Text, Input, chakra } from "@chakra-ui/react";
import { useChat } from "../useChat";
import { useSession } from "../useSession";
import { PlatformIcon } from "./PlatformIcon";
import type { SearchResult } from "../chat/types";

function LiveTag({ isLive }: { isLive: boolean }) {
  return isLive ? (
    <Flex align="center" gap="5px" flex="none">
      <Box w="6px" h="6px" borderRadius="full" bg="#FF5C5C" />
      <Text fontFamily="mono" fontSize="10px" fontWeight="600" color="#FF5C5C">
        LIVE
      </Text>
    </Flex>
  ) : (
    <Text fontFamily="mono" fontSize="10px" color="faint" flex="none">
      offline
    </Text>
  );
}

function ResultRow({
  result,
  active,
  twitchOn,
  kickOn,
  onSelect,
}: {
  result: SearchResult;
  active: boolean;
  twitchOn: boolean;
  kickOn: boolean;
  onSelect: () => void;
}) {
  const showTwitch = !!result.twitch && twitchOn;
  const showKick = !!result.kick && kickOn;
  const isLive =
    (showTwitch && result.twitch!.isLive) || (showKick && result.kick!.isLive);

  return (
    <chakra.button
      type="button"
      // mousedown (not click) so it fires before the input blur closes the pane.
      onMouseDown={(e) => {
        e.preventDefault();
        onSelect();
      }}
      display="flex"
      alignItems="center"
      gap="11px"
      w="100%"
      px="14px"
      py="10px"
      bg={active ? "raised" : "transparent"}
      color={active ? "text" : "muted"}
      cursor="pointer"
      transition="background .1s, color .1s"
      _hover={{ bg: "raised", color: "text" }}
    >
      <Flex align="center" gap="4px" flex="none">
        {showTwitch && <PlatformIcon platform="twitch" size={16} />}
        {showKick && <PlatformIcon platform="kick" size={15} />}
      </Flex>
      <Text flex="1" minW="0" fontSize="14px" textAlign="left" truncate>
        {result.displayName}
      </Text>
      <LiveTag isLive={isLive} />
    </chakra.button>
  );
}

export function StreamerSearch() {
  const { activeChannel, activeKickOnly, selectSearchResult, addWatchedChannel } = useChat();
  const { activeFilters } = useSession();
  const twitchOn = activeFilters.has("twitch");
  const kickOn = activeFilters.has("kick");

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState(false);

  // Debounced search across both platforms.
  useEffect(() => {
    const q = query.trim();
    let cancelled = false;
    /* eslint-disable react-hooks/set-state-in-effect */
    if (!q) {
      setResults([]);
      setSearching(false);
      return;
    }
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
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query]);

  const visibleResults = results.filter(
    (r) => (r.twitch && twitchOn) || (r.kick && kickOn)
  );

  function isActive(r: SearchResult): boolean {
    if (r.twitch && activeChannel) return activeChannel.id === r.twitch.id;
    if (!r.twitch && r.kick) return activeKickOnly === r.kick.slug.toLowerCase();
    return false;
  }

  function handleSelect(r: SearchResult) {
    selectSearchResult(r);
    addWatchedChannel(r);
    setOpen(false);
  }

  const showPane = open && query.trim() !== "";

  return (
    <Box position="relative" flex="1" maxW="460px" mx="auto">
      <Flex
        align="center"
        gap="10px"
        bg="field"
        borderWidth="1px"
        borderColor={showPane ? "muted" : "fieldLine"}
        borderRadius={showPane ? "12px 12px 0 0" : "12px"}
        px="14px"
        h="38px"
        transition="border-color .12s"
      >
        <svg width="15" height="15" viewBox="0 0 20 20" fill="none" aria-hidden>
          <circle cx="9" cy="9" r="6.5" stroke="#8B93A7" strokeWidth="1.6" />
          <path d="M14 14 L18 18" stroke="#8B93A7" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
        <Input
          flex="1"
          variant="flushed"
          border="none"
          px="0"
          fontSize="14px"
          color="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          placeholder="Search streamers on Twitch & Kick…"
          _placeholder={{ color: "faint" }}
          _focusVisible={{ outline: "none", boxShadow: "none", borderColor: "transparent" }}
        />
        {query && (
          <chakra.button
            type="button"
            onClick={() => setQuery("")}
            title="Clear"
            color="faint"
            cursor="pointer"
            fontSize="13px"
            _hover={{ color: "muted" }}
          >
            ✕
          </chakra.button>
        )}
      </Flex>

      {showPane && (
        <Box
          position="absolute"
          top="100%"
          left="0"
          right="0"
          maxH="360px"
          overflowY="auto"
          bg="panel"
          borderWidth="1px"
          borderTopWidth="0"
          borderColor="muted"
          borderRadius="0 0 12px 12px"
          boxShadow="0 14px 40px rgba(0,0,0,0.45)"
          zIndex={20}
          py="6px"
        >
          {searching ? (
            <Text fontSize="13px" color="faint" px="14px" py="10px">
              Searching…
            </Text>
          ) : visibleResults.length === 0 ? (
            <Text fontSize="13px" color="faint" px="14px" py="10px">
              No streamers found
            </Text>
          ) : (
            visibleResults.map((r) => (
              <ResultRow
                key={r.handle}
                result={r}
                active={isActive(r)}
                twitchOn={twitchOn}
                kickOn={kickOn}
                onSelect={() => handleSelect(r)}
              />
            ))
          )}
        </Box>
      )}
    </Box>
  );
}
