"use client";

import { useEffect, useRef, useState } from "react";
import { Box, Flex, Text, chakra } from "@chakra-ui/react";
import { useChat } from "../_ctx/chat";
import { useSession } from "../_ctx/session";
import { PlatformIcon } from "./PlatformIcon";
import type { SearchResult } from "../types";

// ⌘K-style channel search. Opens as a centered overlay; picking a result
// selects the channel and adds it to the WATCHING list. The panel only mounts
// while open, so query state starts fresh every time.
export function CommandSearch({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  return <SearchPanel onClose={onClose} />;
}

function SearchPanel({ onClose }: { onClose: () => void }) {
  const { activeChannel, activeKickOnly, selectSearchResult, addWatchedChannel } = useChat();
  const { activeFilters } = useSession();
  const twitchOn = activeFilters.has("twitch");
  const kickOn = activeFilters.has("kick");

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Escape closes.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

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

  const visible = results.filter((r) => (r.twitch && twitchOn) || (r.kick && kickOn));

  function isActive(r: SearchResult): boolean {
    if (r.twitch && activeChannel) return activeChannel.id === r.twitch.id;
    if (!r.twitch && r.kick) return activeKickOnly === r.kick.slug.toLowerCase();
    return false;
  }

  function handleSelect(r: SearchResult) {
    selectSearchResult(r);
    addWatchedChannel(r);
    onClose();
  }

  return (
    <Box
      position="fixed"
      inset="0"
      zIndex={100}
      bg="rgba(0,0,0,0.6)"
      backdropFilter="blur(3px)"
      onClick={onClose}
    >
      <Box
        mx="auto"
        mt="14vh"
        w="min(560px, calc(100vw - 40px))"
        bg="panel"
        borderWidth="1px"
        borderColor="fieldLine"
        borderRadius="14px"
        boxShadow="0 24px 80px rgba(0,0,0,0.6)"
        overflow="hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <Flex align="center" gap="11px" px="16px" h="48px" borderBottomWidth="1px" borderColor="line">
          <svg width="15" height="15" viewBox="0 0 20 20" fill="none" aria-hidden>
            <circle cx="9" cy="9" r="6.5" stroke="#8B93A7" strokeWidth="1.6" />
            <path d="M14 14 L18 18" stroke="#8B93A7" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
          <chakra.input
            ref={inputRef}
            autoFocus
            flex="1"
            minW="0"
            fontSize="14px"
            color="text"
            bg="transparent"
            border="none"
            outline="none"
            value={query}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setQuery(e.target.value)}
            placeholder="Search streamers on Twitch & Kick…"
            _placeholder={{ color: "faint" }}
          />
          <Text fontFamily="mono" fontSize="10px" color="faint" flex="none">
            esc
          </Text>
        </Flex>

        {query.trim() !== "" && (
          <Box maxH="320px" overflowY="auto" py="6px">
            {searching ? (
              <Text fontSize="13px" color="faint" px="16px" py="10px">
                Searching…
              </Text>
            ) : visible.length === 0 ? (
              <Text fontSize="13px" color="faint" px="16px" py="10px">
                No streamers found
              </Text>
            ) : (
              visible.map((r) => {
                const showTwitch = !!r.twitch && twitchOn;
                const showKick = !!r.kick && kickOn;
                const isLive = (showTwitch && r.twitch!.isLive) || (showKick && r.kick!.isLive);
                return (
                  <chakra.button
                    key={r.handle}
                    type="button"
                    onClick={() => handleSelect(r)}
                    display="flex"
                    alignItems="center"
                    gap="11px"
                    w="100%"
                    px="16px"
                    py="10px"
                    bg={isActive(r) ? "raised" : "transparent"}
                    color={isActive(r) ? "text" : "muted"}
                    cursor="pointer"
                    transition="background .1s, color .1s"
                    _hover={{ bg: "raised", color: "text" }}
                  >
                    <Flex align="center" gap="4px" flex="none">
                      {showTwitch && <PlatformIcon platform="twitch" size={15} />}
                      {showKick && <PlatformIcon platform="kick" size={14} />}
                    </Flex>
                    <Text flex="1" minW="0" fontSize="13px" textAlign="left" truncate>
                      {r.displayName}
                    </Text>
                    {isLive ? (
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
                    )}
                  </chakra.button>
                );
              })
            )}
          </Box>
        )}
      </Box>
    </Box>
  );
}
