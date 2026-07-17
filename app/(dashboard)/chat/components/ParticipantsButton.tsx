"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Box, Flex, Input, Text, chakra } from "@chakra-ui/react";
import { useChat, type MentionCandidate } from "../../_ctx/chat";
import { PlatformIcon, PLATFORM_COLOR, PLATFORM_LABEL } from "../../components/PlatformIcon";
import type { Platform, UserSelection } from "../../types";

type Filter = "all" | "twitch" | "kick";

function PeopleIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm0 2c-3.3 0-8 1.7-8 5v2h10.2A5.9 5.9 0 0 1 11 20c0-2 .9-3.8 2.3-5.1C12 13.3 10.4 13 9 13Zm8.5 1a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm0 2c-2.6 0-5.5 1.4-5.5 4v1h11v-1c0-2.6-2.9-4-5.5-4Z" />
    </svg>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <Box
      as="span"
      color="faint"
      display="inline-flex"
      transform={open ? "rotate(180deg)" : "none"}
      transition="transform .15s"
    >
      <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden>
        <path d="M1 3 L5 7 L9 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </Box>
  );
}

// The participants roster, anchored to the right of the chat WATCHING header.
// Shows chatters SEEN THIS SESSION (a real viewer roster isn't obtainable for
// channels you don't moderate), filterable by platform, searchable. Reads the
// ref-backed registry via a ~2s snapshot so it never re-renders per message.
export default function ParticipantsButton({
  available,
  onSelectUser,
}: {
  available: Platform[];
  onSelectUser?: (selection: UserSelection) => void;
}) {
  const { getAllParticipants } = useChat();
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [people, setPeople] = useState<MentionCandidate[]>([]);
  const rootRef = useRef<HTMLDivElement>(null);

  // Only twitch/kick have a chatter identity to roster.
  const platforms = useMemo(
    () => available.filter((p): p is "twitch" | "kick" => p === "twitch" || p === "kick"),
    [available]
  );
  const platformsKey = platforms.join(",");

  // Snapshot the registry on an interval (indirection through `tick` keeps the
  // setState out of the effect body proper). Polls whether open or closed so the
  // header count stays live.
  useEffect(() => {
    const list = platformsKey ? platformsKey.split(",") as ("twitch" | "kick")[] : [];
    const tick = () => setPeople(getAllParticipants(list));
    tick();
    const id = setInterval(tick, 2000);
    return () => clearInterval(id);
  }, [platformsKey, getAllParticipants]);

  // Close on outside click / Escape while open.
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const counts = useMemo(() => {
    let twitch = 0, kick = 0;
    for (const p of people) {
      if (p.platform === "twitch") twitch++;
      else kick++;
    }
    return { all: people.length, twitch, kick };
  }, [people]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return people.filter(
      (p) => (filter === "all" || p.platform === filter) && (!q || p.user.toLowerCase().includes(q))
    );
  }, [people, filter, query]);

  // Only offer per-platform filter pills when both platforms are in play.
  const showFilters = platforms.length > 1;
  const scopeLabel = filter === "all" ? "" : `${PLATFORM_LABEL[filter]} · `;

  return (
    <Box position="relative" ref={rootRef} flex="none">
      <chakra.button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label="Participants"
        title="Chatters seen this session"
        display="inline-flex"
        alignItems="center"
        gap="7px"
        pl="9px"
        pr="10px"
        py="4px"
        borderRadius="full"
        borderWidth="1px"
        borderColor="fieldLine"
        bg={open ? "raised" : "field"}
        color={open ? "text" : "muted"}
        cursor="pointer"
        transition="background .12s, color .12s, border-color .12s"
        _hover={{ color: "text", borderColor: "#2f3850" }}
      >
        <PeopleIcon />
        <Text fontFamily="mono" fontSize="12px" fontWeight="600" style={{ fontVariantNumeric: "tabular-nums" }}>
          {counts.all}
        </Text>
        <Chevron open={open} />
      </chakra.button>

      {open && (
        <Box
          position="absolute"
          top="calc(100% + 8px)"
          right="0"
          w="268px"
          maxH="420px"
          bg="panel"
          borderWidth="1px"
          borderColor="line"
          borderRadius="12px"
          overflow="hidden"
          display="flex"
          flexDirection="column"
          zIndex={30}
          boxShadow="0 20px 50px rgba(0,0,0,0.6)"
        >
          <Flex justify="space-between" align="baseline" px="12px" pt="10px" pb="8px">
            <Text fontFamily="mono" fontSize="10px" letterSpacing="0.12em" color="muted">
              PARTICIPANTS
            </Text>
            <Text fontFamily="mono" fontSize="9px" letterSpacing="0.04em" color="faint">
              seen this session
            </Text>
          </Flex>

          {showFilters && (
            <Flex gap="6px" px="12px" pb="8px">
              {(["all", ...platforms] as Filter[]).map((f) => {
                const active = filter === f;
                const color = f === "all" ? null : PLATFORM_COLOR[f];
                const count = counts[f];
                return (
                  <chakra.button
                    key={f}
                    type="button"
                    onClick={() => setFilter(f)}
                    aria-pressed={active}
                    display="inline-flex"
                    alignItems="center"
                    gap="6px"
                    px="9px"
                    py="4px"
                    borderRadius="full"
                    borderWidth="1px"
                    borderColor={active ? (color ? `${color}73` : "#2f3850") : "fieldLine"}
                    bg={active ? (color ? `${color}1F` : "raised") : "transparent"}
                    color={active ? "text" : "faint"}
                    cursor="pointer"
                    fontSize="11px"
                    fontWeight="600"
                    transition="background .12s, color .12s, border-color .12s"
                    _hover={{ color: "text" }}
                  >
                    {color && <Box w="7px" h="7px" borderRadius="full" bg={color} flex="none" />}
                    {f === "all" ? "All" : PLATFORM_LABEL[f]}
                    <Text as="span" fontFamily="mono" opacity={0.8} style={{ fontVariantNumeric: "tabular-nums" }}>
                      {count}
                    </Text>
                  </chakra.button>
                );
              })}
            </Flex>
          )}

          <Box px="12px" pb="8px">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter chatters…"
              h="30px"
              fontSize="12px"
              bg="field"
              borderColor="fieldLine"
              borderRadius="8px"
              color="text"
              _placeholder={{ color: "faint" }}
              _focusVisible={{ borderColor: "#2f3850", boxShadow: "none" }}
            />
          </Box>

          <Box overflowY="auto" px="6px" py="2px" borderTopWidth="1px" borderColor="line">
            {filtered.length === 0 ? (
              <Text fontSize="12px" color="faint" textAlign="center" py="18px">
                {query ? "No chatters match that." : "No one has chatted yet this session."}
              </Text>
            ) : (
              filtered.map((p) => (
                <chakra.button
                  key={`${p.platform}:${p.user}`}
                  type="button"
                  onClick={() => {
                    onSelectUser?.({ platform: p.platform, user: p.user, userId: p.userId });
                    setOpen(false);
                  }}
                  display="flex"
                  alignItems="center"
                  gap="8px"
                  w="100%"
                  px="8px"
                  py="6px"
                  borderRadius="6px"
                  cursor="pointer"
                  transition="background .1s"
                  _hover={{ bg: "raised" }}
                >
                  <PlatformIcon platform={p.platform} color={PLATFORM_COLOR[p.platform]} size={12} />
                  <Text fontSize="13px" fontWeight="600" color={p.color || PLATFORM_COLOR[p.platform]} truncate>
                    {p.user}
                  </Text>
                </chakra.button>
              ))
            )}
          </Box>

          <Text
            px="12px" py="8px"
            borderTopWidth="1px" borderColor="line"
            fontFamily="mono" fontSize="9px" letterSpacing="0.04em" color="faint"
          >
            {`${scopeLabel}${filtered.length} chatter${filtered.length === 1 ? "" : "s"} seen this session`}
          </Text>
        </Box>
      )}
    </Box>
  );
}
