"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Box, Flex, Input, Text, chakra } from "@chakra-ui/react";
import { useChat, type MentionCandidate } from "../../_ctx/chat";
import { PlatformIcon, PLATFORM_COLOR, PLATFORM_LABEL } from "../../components/PlatformIcon";
import { ROLE_SECTIONS, isKnownBot, type ParticipantRole } from "../participantRole";
import { BadgeChip } from "./ChatMessage";
import type { Platform, UserSelection } from "../../types";

// The channel badge that represents each role. Twitch's global badge set (loaded
// by BadgeProvider) has real art for these; Kick has none, so BadgeChip falls
// back to its HOST/MOD/VIP text label for kick.
const ROLE_BADGE: Partial<Record<ParticipantRole, { setId: string; id: string }>> = {
  broadcaster: { setId: "broadcaster", id: "1" },
  moderator: { setId: "moderator", id: "1" },
  vip: { setId: "vip", id: "1" },
};

interface ModVip {
  mods: { user: string; id?: string }[];
  vips: { user: string; id?: string }[];
}

const ROLE_RANK: Record<ParticipantRole, number> = {
  viewer: 1, vip: 2, moderator: 3, bot: 4, broadcaster: 5,
};

function PeopleIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
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
// Broadcaster, moderators and VIPs are REAL rosters (broadcaster from the active
// channel; Twitch mods/VIPs via ivr.fi). Viewers are chatters seen this session
// (no full viewer roster is obtainable). Chat bots are matched by a known list.
// Reads the message-derived registry via a ~2s snapshot so it never re-renders
// per message. One platform is shown at a time — pick which with the pills.
export default function ParticipantsButton({
  available,
  onSelectUser,
}: {
  available: Platform[];
  onSelectUser?: (selection: UserSelection) => void;
}) {
  const { getAllParticipants, activeChannel, activeKick, activeKickOnly } = useChat();
  const [open, setOpen] = useState(false);
  const [pick, setPick] = useState<"twitch" | "kick">("twitch");
  const [query, setQuery] = useState("");
  const [people, setPeople] = useState<MentionCandidate[]>([]);
  const [modvip, setModvip] = useState<ModVip>({ mods: [], vips: [] });
  const rootRef = useRef<HTMLDivElement>(null);

  // Only twitch/kick have a chatter identity to roster.
  const platforms = useMemo(
    () => available.filter((p): p is "twitch" | "kick" => p === "twitch" || p === "kick"),
    [available]
  );
  const platformsKey = platforms.join(",");

  // The platform currently shown — the user's pick if it's available, else the
  // first available platform.
  const filter: "twitch" | "kick" = platforms.includes(pick) ? pick : (platforms[0] ?? "twitch");

  // Snapshot the message-derived registry on an interval (indirection through
  // `tick` keeps the setState out of the effect body proper).
  useEffect(() => {
    const list = platformsKey ? platformsKey.split(",") as ("twitch" | "kick")[] : [];
    const tick = () => setPeople(getAllParticipants(list));
    tick();
    const id = setInterval(tick, 2000);
    return () => clearInterval(id);
  }, [platformsKey, getAllParticipants]);

  // Real Twitch mod/VIP rosters for the active channel (ivr.fi), refetched on
  // channel switch. Kick has no equivalent source.
  const twitchLogin = platforms.includes("twitch") ? (activeChannel?.login ?? null) : null;
  useEffect(() => {
    let cancelled = false;
    async function load() {
      // Clear the previous channel's roster immediately so it can't show under
      // the new channel during the fetch gap.
      setModvip({ mods: [], vips: [] });
      if (!twitchLogin) return;
      try {
        const res = await fetch(`/api/twitch/modvip?login=${encodeURIComponent(twitchLogin)}`);
        if (!res.ok) return;
        const j = (await res.json()) as ModVip;
        if (!cancelled) setModvip({ mods: j.mods ?? [], vips: j.vips ?? [] });
      } catch {
        /* ignore — roster degrades to broadcaster + observed chatters */
      }
    }
    load();
    return () => { cancelled = true; };
  }, [twitchLogin]);

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

  // Merge everything into one roster: observed chatters (registry) + real Twitch
  // mods/VIPs + the known broadcaster. Higher-ranked role wins per person; the
  // richer identity (chat color / id) is kept when we have it.
  const roster = useMemo(() => {
    const map = new Map<string, MentionCandidate>();
    const put = (cand: MentionCandidate) => {
      const key = `${cand.platform}:${cand.user.toLowerCase()}`;
      const ex = map.get(key);
      if (!ex) { map.set(key, cand); return; }
      const role = ROLE_RANK[cand.role ?? "viewer"] > ROLE_RANK[ex.role ?? "viewer"] ? cand.role : ex.role;
      map.set(key, { ...ex, userId: ex.userId ?? cand.userId, color: ex.color ?? cand.color, role });
    };

    for (const p of people) put(p);

    for (const v of modvip.vips)
      put({ user: v.user, platform: "twitch", color: null, userId: v.id, role: isKnownBot(v.user) ? "bot" : "vip" });
    for (const m of modvip.mods)
      put({ user: m.user, platform: "twitch", color: null, userId: m.id, role: isKnownBot(m.user) ? "bot" : "moderator" });

    if (platforms.includes("twitch") && activeChannel)
      put({ user: activeChannel.displayName, platform: "twitch", color: null, userId: activeChannel.id, role: "broadcaster" });
    const kickSlug = activeKick?.slug ?? activeKickOnly;
    if (platforms.includes("kick") && kickSlug)
      put({ user: kickSlug, platform: "kick", color: null, role: "broadcaster" });

    return [...map.values()];
  }, [people, modvip, platforms, activeChannel, activeKick, activeKickOnly]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return roster.filter((p) => p.platform === filter && (!q || p.user.toLowerCase().includes(q)));
  }, [roster, filter, query]);

  // Group the filtered roster into Twitch "Community"-style role buckets.
  const grouped = useMemo(() => {
    const by: Record<ParticipantRole, MentionCandidate[]> = {
      broadcaster: [], moderator: [], vip: [], bot: [], viewer: [],
    };
    for (const p of filtered) by[p.role ?? "viewer"].push(p);
    return by;
  }, [filtered]);

  // Pills let you cycle which platform's community you're viewing.
  const showFilters = platforms.length > 1;

  return (
    <Box position="relative" ref={rootRef} flex="none">
      <chakra.button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label="Participants"
        title="Community"
        display="inline-flex"
        alignItems="center"
        gap="6px"
        px="9px"
        py="5px"
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
        <Chevron open={open} />
      </chakra.button>

      {open && (
        <Box
          position="absolute"
          top="calc(100% + 8px)"
          right="0"
          w="268px"
          maxH="440px"
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
              COMMUNITY
            </Text>
            <Text fontFamily="mono" fontSize="9px" letterSpacing="0.08em" color="faint">
              {PLATFORM_LABEL[filter].toUpperCase()}
            </Text>
          </Flex>

          {showFilters && (
            <Flex gap="6px" px="12px" pb="8px">
              {platforms.map((p) => {
                const active = filter === p;
                const color = PLATFORM_COLOR[p];
                return (
                  <chakra.button
                    key={p}
                    type="button"
                    onClick={() => setPick(p)}
                    aria-pressed={active}
                    display="inline-flex"
                    alignItems="center"
                    gap="6px"
                    px="10px"
                    py="4px"
                    borderRadius="full"
                    borderWidth="1px"
                    borderColor={active ? `${color}73` : "fieldLine"}
                    bg={active ? `${color}1F` : "transparent"}
                    color={active ? "text" : "faint"}
                    cursor="pointer"
                    fontSize="11px"
                    fontWeight="600"
                    transition="background .12s, color .12s, border-color .12s"
                    _hover={{ color: "text" }}
                  >
                    <Box w="7px" h="7px" borderRadius="full" bg={color} flex="none" />
                    {PLATFORM_LABEL[p]}
                  </chakra.button>
                );
              })}
            </Flex>
          )}

          <Box px="12px" pb="8px">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Find someone…"
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
                {query ? "No one matches that." : "No one here yet."}
              </Text>
            ) : (
              ROLE_SECTIONS.map(({ role, label }) => {
                const rows = grouped[role];
                if (rows.length === 0) return null;
                return (
                  <Box key={role} pb="2px">
                    <Flex align="center" justify="space-between" px="8px" pt="9px" pb="3px">
                      <Text fontFamily="mono" fontSize="9px" letterSpacing="0.1em" color="faint">
                        {label}
                      </Text>
                      <Text fontFamily="mono" fontSize="9px" color="faint" style={{ fontVariantNumeric: "tabular-nums" }}>
                        {rows.length}
                      </Text>
                    </Flex>
                    {rows.map((p) => (
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
                        {(() => {
                          const badge = ROLE_BADGE[p.role ?? "viewer"];
                          return badge ? (
                            <BadgeChip platform={p.platform} badge={badge} accent={PLATFORM_COLOR[p.platform]} />
                          ) : null;
                        })()}
                        <Text fontSize="13px" fontWeight="600" color={p.color || PLATFORM_COLOR[p.platform]} truncate>
                          {p.user}
                        </Text>
                      </chakra.button>
                    ))}
                  </Box>
                );
              })
            )}
          </Box>

          <Text
            px="12px" py="8px"
            borderTopWidth="1px" borderColor="line"
            fontFamily="mono" fontSize="9px" letterSpacing="0.04em" color="faint"
          >
            Viewers = seen in chat this session
          </Text>
        </Box>
      )}
    </Box>
  );
}
