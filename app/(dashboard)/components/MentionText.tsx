"use client";

import { useEffect, useMemo, useState } from "react";
import { Box, Flex, Text, chakra } from "@chakra-ui/react";
import { PlatformIcon, PLATFORM_COLOR } from "./PlatformIcon";
import type { SearchResult } from "../types";
import { c } from "../../theme-colors";

interface Social {
  name: string;
  title: string;
  url: string;
}

// A handle is @ followed by 2–25 word chars — the Twitch/Kick username charset.
const MENTION_RE = /@([a-zA-Z0-9_]{2,25})/g;

interface Segment {
  text: string;
  handle?: string;
}

function splitMentions(text: string): Segment[] {
  const parts: Segment[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  MENTION_RE.lastIndex = 0;
  while ((m = MENTION_RE.exec(text)) !== null) {
    if (m.index > last) parts.push({ text: text.slice(last, m.index) });
    parts.push({ text: m[0], handle: m[1] });
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push({ text: text.slice(last) });
  return parts;
}

interface OpenMention {
  handle: string;
  x: number;
  y: number;
}

// Renders text where @mentions become clickable — clicking one opens a small
// About card for that streamer, resolved live from the unified search. The
// card is positioned with `fixed` off the click point so it escapes any
// truncating/overflow-hidden container (e.g. the top-bar pill title).
export function MentionText({ text }: { text: string }) {
  const segments = useMemo(() => splitMentions(text), [text]);
  const [open, setOpen] = useState<OpenMention | null>(null);

  if (segments.length === 1 && !segments[0].handle) return <>{text}</>;

  return (
    <>
      {segments.map((seg, i) =>
        seg.handle ? (
          <chakra.button
            key={i}
            type="button"
            onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
              e.stopPropagation();
              const r = e.currentTarget.getBoundingClientRect();
              setOpen((o) =>
                o?.handle === seg.handle ? null : { handle: seg.handle!, x: r.left, y: r.bottom }
              );
            }}
            display="inline"
            bg="transparent"
            cursor="pointer"
            fontWeight="600"
            style={{ color: PLATFORM_COLOR.twitch }}
            _hover={{ transform: "none", boxShadow: "none", textDecoration: "underline" }}
          >
            {seg.text}
          </chakra.button>
        ) : (
          <Box key={i} as="span">
            {seg.text}
          </Box>
        )
      )}
      {open && (
        <MentionCard handle={open.handle} x={open.x} y={open.y} onClose={() => setOpen(null)} />
      )}
    </>
  );
}

function SocialChip({ label, url }: { label: string; url: string }) {
  return (
    <chakra.a
      href={url}
      target="_blank"
      rel="noreferrer"
      display="inline-flex"
      alignItems="center"
      gap="5px"
      px="9px"
      h="26px"
      borderRadius="7px"
      borderWidth="1px"
      borderColor="fieldLine"
      bg="bg"
      fontSize="11px"
      fontWeight="500"
      color="muted"
      _hover={{ transform: "none", boxShadow: "none", color: "text", borderColor: "muted" }}
    >
      {label}
      <Box as="span" color="faint" fontSize="10px">↗</Box>
    </chakra.a>
  );
}

const CARD_WIDTH = 290;

// Compact about card for a mentioned streamer. Fixed-positioned off the click
// point (so it survives truncating containers); resolves the handle to platform
// presence + Twitch bio/socials on open.
function MentionCard({ handle, x, y, onClose }: { handle: string; x: number; y: number; onClose: () => void }) {
  const [result, setResult] = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [bio, setBio] = useState<string>("");
  const [socials, setSocials] = useState<Social[]>([]);

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    fetch(`/api/search?q=${encodeURIComponent(handle)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { results?: SearchResult[] } | null) => {
        if (cancelled) return;
        const lower = handle.toLowerCase();
        const results = j?.results ?? [];
        const match =
          results.find(
            (r) =>
              r.handle.toLowerCase() === lower ||
              r.twitch?.login.toLowerCase() === lower ||
              r.kick?.slug.toLowerCase() === lower
          ) ??
          results[0] ??
          null;
        setResult(match);
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [handle]);

  const twitchId = result?.twitch?.id ?? null;
  const twitchLogin = result?.twitch?.login ?? null;

  useEffect(() => {
    if (!twitchId) return;
    let cancelled = false;
    fetch(`/api/twitch/user?id=${twitchId}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { user?: { description?: string } | null } | null) => {
        if (!cancelled && j?.user?.description) setBio(j.user.description);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [twitchId]);

  useEffect(() => {
    if (!twitchLogin) return;
    let cancelled = false;
    fetch(`/api/twitch/socials?login=${encodeURIComponent(twitchLogin)}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { socials?: Social[] } | null) => {
        if (!cancelled && j?.socials) setSocials(j.socials);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [twitchLogin]);

  const name = result?.displayName ?? handle;
  const avatar = result?.profileImageUrl ?? null;
  const isLive = result?.twitch?.isLive || result?.kick?.isLive;
  const kickSlug = result?.kick?.slug ?? null;
  const twitchHref = twitchLogin ? `https://twitch.tv/${twitchLogin}` : `https://twitch.tv/${handle}`;
  const kickHref = kickSlug ? `https://kick.com/${kickSlug}` : null;

  // Keep the card on-screen: clamp against the right/left viewport edges.
  const vw = typeof window !== "undefined" ? window.innerWidth : 1280;
  const left = Math.max(12, Math.min(x, vw - CARD_WIDTH - 12));

  return (
    <>
      {/* Click-catcher — closes only this card, keeps the parent card open. */}
      <Box
        position="fixed" inset="0" zIndex={55}
        onClick={(e: React.MouseEvent) => { e.stopPropagation(); onClose(); }}
      />
      <Box
        position="fixed"
        style={{ left: `${left}px`, top: `${y + 6}px` }}
        zIndex={60}
        w={`${CARD_WIDTH}px`}
        maxW="calc(100vw - 24px)"
        bg="panel"
        borderWidth="1px"
        borderColor="fieldLine"
        borderRadius="12px"
        boxShadow="0 24px 60px rgba(0,0,0,0.65)"
        p="13px"
        cursor="default"
        textAlign="left"
        fontWeight="400"
        onClick={(e: React.MouseEvent) => e.stopPropagation()}
      >
        {loading ? (
          <Text fontSize="12px" color="faint">Looking up @{handle}…</Text>
        ) : (
          <>
            <Flex align="center" gap="10px" mb={bio || socials.length ? "11px" : "0"}>
              {avatar ? (
                <chakra.img src={avatar} alt={name} w="38px" h="38px" borderRadius="full" objectFit="cover" flex="none" />
              ) : (
                <Flex w="38px" h="38px" borderRadius="full" bg="raised" flex="none" align="center" justify="center" fontSize="15px" fontWeight="700" color="muted">
                  {name[0]?.toUpperCase()}
                </Flex>
              )}
              <Box minW="0" flex="1">
                <Text fontSize="14px" fontWeight="700" color="text" truncate>{name}</Text>
                <Flex align="center" gap="7px" mt="2px">
                  {result?.twitch && (
                    <chakra.a
                      href={twitchHref} target="_blank" rel="noreferrer"
                      display="inline-flex" flex="none" title="Open on Twitch"
                      onClick={(e: React.MouseEvent) => e.stopPropagation()}
                      _hover={{ transform: "none", boxShadow: "none", opacity: 0.6 }}
                    >
                      <PlatformIcon platform="twitch" color={result.twitch.isLive ? PLATFORM_COLOR.twitch : c.lineStrong} size={13} />
                    </chakra.a>
                  )}
                  {result?.kick && kickHref && (
                    <chakra.a
                      href={kickHref} target="_blank" rel="noreferrer"
                      display="inline-flex" flex="none" title="Open on Kick"
                      onClick={(e: React.MouseEvent) => e.stopPropagation()}
                      _hover={{ transform: "none", boxShadow: "none", opacity: 0.6 }}
                    >
                      <PlatformIcon platform="kick" color={result.kick.isLive ? PLATFORM_COLOR.kick : c.lineStrong} size={12} />
                    </chakra.a>
                  )}
                  {isLive ? (
                    <Flex align="center" gap="4px" flex="none">
                      <Box w="5px" h="5px" borderRadius="full" bg="#FF5C5C" animation="pris-pulse 1.4s ease-in-out infinite" />
                      <Text fontFamily="mono" fontSize="9px" fontWeight="700" color="#FF5C5C">LIVE</Text>
                    </Flex>
                  ) : result ? (
                    <Text fontFamily="mono" fontSize="9px" color="faint" flex="none">OFFLINE</Text>
                  ) : null}
                </Flex>
              </Box>
            </Flex>

            {!result && (
              <Text fontSize="12px" color="muted">
                No channel found for @{handle}.{" "}
                <chakra.a href={twitchHref} target="_blank" rel="noreferrer" color={PLATFORM_COLOR.twitch} _hover={{ transform: "none", boxShadow: "none", textDecoration: "underline" }}>
                  Open on Twitch ↗
                </chakra.a>
              </Text>
            )}

            {bio && (
              <Text fontSize="12px" color="muted" lineHeight="1.5" style={{ overflowWrap: "anywhere" }}>
                {bio}
              </Text>
            )}

            {socials.length > 0 && (
              <Flex wrap="wrap" gap="6px" mt="11px" pt="11px" borderTopWidth="1px" borderColor="line">
                {socials.map((s) => (
                  <SocialChip key={s.url} label={s.title} url={s.url} />
                ))}
              </Flex>
            )}
          </>
        )}
      </Box>
    </>
  );
}
