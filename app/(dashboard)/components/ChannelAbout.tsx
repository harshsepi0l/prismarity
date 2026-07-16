"use client";

import { useEffect, useState } from "react";
import { Box, Flex, Text, chakra } from "@chakra-ui/react";
import { useChat } from "../_ctx/chat";
import { useStats, formatUptime, type PlatformLive } from "../_ctx/stats";
import { PlatformIcon, PLATFORM_COLOR, VerifiedBadge } from "./PlatformIcon";
import { MentionText } from "./MentionText";

interface TwitchProfile {
  description: string;
  createdAt: string;
  broadcasterType: string;
}

interface Social {
  name: string;
  title: string;
  url: string;
}

// Subtle per-platform background + border tint for the stat cards.
const TINT: Record<string, { bg: string; border: string }> = {
  twitch: { bg: "rgba(166,108,255,0.10)", border: "rgba(166,108,255,0.32)" },
  kick: { bg: "rgba(91,227,125,0.10)", border: "rgba(91,227,125,0.32)" },
  youtube: { bg: "rgba(255,92,92,0.10)", border: "rgba(255,92,92,0.32)" },
};

function fmt(n: number | null): string {
  if (n == null) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function ParticipantChip({ name, avatar, verified }: { name: string; avatar: string | null; verified: boolean }) {
  return (
    <Flex align="center" gap="5px" flex="none">
      {avatar ? (
        <chakra.img src={avatar} alt={name} w="18px" h="18px" borderRadius="full" objectFit="cover" flex="none" />
      ) : (
        <Flex w="18px" h="18px" borderRadius="full" bg="raised" flex="none" align="center" justify="center" fontSize="8px" fontWeight="700" color="muted">
          {name[0]?.toUpperCase()}
        </Flex>
      )}
      <Text fontSize="12px" fontWeight="600" color="text">{name}</Text>
      {verified && <VerifiedBadge size={12} title="Verified partner" />}
    </Flex>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Box>
      <Text fontFamily="mono" fontSize="9px" letterSpacing="0.1em" color="faint">
        {label}
      </Text>
      <Text fontSize="13px" fontWeight="600" color="text">
        {value}
      </Text>
    </Box>
  );
}

function PlatformSection({ p, href }: { p: PlatformLive; href: string | null }) {
  const color = PLATFORM_COLOR[p.platform];
  const label = p.platform === "twitch" ? "Twitch" : p.platform === "kick" ? "Kick" : "YouTube";
  const tint = TINT[p.platform] ?? { bg: "transparent", border: "#1B2130" };

  return (
    <Box
      borderWidth="1px" borderRadius="10px" p="11px"
      style={{ background: tint.bg, borderColor: tint.border }}
    >
      <Flex align="center" gap="8px" mb={p.isLive || p.followers != null || p.subs != null ? "9px" : "0"}>
        <PlatformIcon platform={p.platform} color={color} size={14} />
        <Text fontSize="12px" fontWeight="600" color="text" flex="none">
          {label}
        </Text>
        {p.verified && <VerifiedBadge size={12} color={color} title={`Verified on ${label}`} />}
        {p.isLive ? (
          <Flex align="center" gap="4px" flex="none">
            <Box w="5px" h="5px" borderRadius="full" bg="#FF5C5C" animation="pris-pulse 1.4s ease-in-out infinite" />
            <Text fontFamily="mono" fontSize="9px" fontWeight="700" color="#FF5C5C">
              LIVE
            </Text>
          </Flex>
        ) : (
          <Text fontFamily="mono" fontSize="9px" color="faint" flex="none">
            OFFLINE
          </Text>
        )}
        <Box flex="1" />
        {href && (
          <chakra.a
            href={href}
            target="_blank"
            rel="noreferrer"
            fontSize="11px"
            color="muted"
            display="inline-flex"
            alignItems="center"
            gap="3px"
            flex="none"
            _hover={{ color, transform: "none", boxShadow: "none", textDecoration: "underline" }}
          >
            Open ↗
          </chakra.a>
        )}
      </Flex>

      {(p.isLive || p.followers != null || p.subs != null) && (
        <Flex gap="18px" wrap="wrap">
          {p.isLive && <Stat label="VIEWERS" value={fmt(p.viewers)} />}
          {p.followers != null && <Stat label="FOLLOWERS" value={fmt(p.followers)} />}
          {p.subs != null && <Stat label="SUBS" value={fmt(p.subs)} />}
          {p.isLive && p.uptimeMs != null && <Stat label="UPTIME" value={formatUptime(p.uptimeMs)} />}
        </Flex>
      )}

      {p.isLive && (p.title || p.category) && (
        <Text fontSize="12px" color="muted" mt="9px" lineHeight="1.4" style={{ overflowWrap: "anywhere" }}>
          <MentionText text={p.title || "—"} />
          {p.category ? ` · ${p.category}` : ""}
        </Text>
      )}
    </Box>
  );
}

// About card for the currently-selected channel — surfaced by clicking the
// name in the top-bar pill. Shows per-platform live stats, whether they're
// simulcasting, the Twitch bio, and links out to each channel.
export function ChannelAbout({ onClose }: { onClose: () => void }) {
  const { activeChannel, activeKick, activeKickOnly } = useChat();
  const { platforms, collab } = useStats();
  const [twitchProfile, setTwitchProfile] = useState<TwitchProfile | null>(null);
  const [socials, setSocials] = useState<Social[]>([]);

  const twitchId = activeChannel?.id ?? null;
  const twitchLogin = activeChannel?.login ?? null;

  useEffect(() => {
    if (!twitchId) return;
    let cancelled = false;
    fetch(`/api/twitch/user?id=${twitchId}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { user?: { description?: string; createdAt?: string; broadcasterType?: string } | null } | null) => {
        if (!cancelled && j?.user) {
          setTwitchProfile({
            description: j.user.description ?? "",
            createdAt: j.user.createdAt ?? "",
            broadcasterType: j.user.broadcasterType ?? "",
          });
        }
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

  const live = platforms.filter((p) => p.isLive);
  const name = activeChannel?.displayName ?? platforms[0]?.channelName ?? activeKickOnly ?? "";
  const avatar = (live[0] ?? platforms[0])?.profileImageUrl ?? null;

  const kickSlug = activeKick?.slug ?? activeKickOnly ?? null;
  const hrefFor = (p: PlatformLive): string | null =>
    p.platform === "twitch"
      ? twitchLogin ? `https://twitch.tv/${twitchLogin}` : null
      : p.platform === "kick"
        ? kickSlug ? `https://kick.com/${kickSlug}` : null
        : null;

  const since = twitchProfile?.createdAt ? new Date(twitchProfile.createdAt).getFullYear() : null;
  const btype = twitchProfile?.broadcasterType;
  const btypeLabel = btype === "partner" ? "Partner" : btype === "affiliate" ? "Affiliate" : null;

  return (
    <>
      {/* Click-catcher */}
      <Box position="fixed" inset="0" zIndex={40} onClick={onClose} />

      <Box
        position="absolute"
        top="calc(100% + 8px)"
        left="50%"
        transform="translateX(-50%)"
        w="360px"
        maxW="calc(100vw - 32px)"
        zIndex={50}
        bg="panel"
        borderWidth="1px"
        borderColor="fieldLine"
        borderRadius="14px"
        boxShadow="0 24px 70px rgba(0,0,0,0.6)"
        p="15px"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <Flex align="center" gap="11px" mb="13px">
          {avatar ? (
            <chakra.img src={avatar} alt={name} w="42px" h="42px" borderRadius="full" objectFit="cover" flex="none" />
          ) : (
            <Flex w="42px" h="42px" borderRadius="full" bg="raised" flex="none" align="center" justify="center" fontSize="17px" fontWeight="700" color="muted">
              {name[0]?.toUpperCase()}
            </Flex>
          )}
          <Box minW="0" flex="1">
            <Text fontSize="16px" fontWeight="700" color="text" truncate>
              {name}
            </Text>
            <Flex align="center" gap="7px" mt="2px">
              {btypeLabel && (
                <Text fontFamily="mono" fontSize="9px" fontWeight="600" letterSpacing="0.08em" color={PLATFORM_COLOR.twitch}>
                  {btypeLabel.toUpperCase()}
                </Text>
              )}
              {since && (
                <Text fontSize="11px" color="faint">
                  on Twitch since {since}
                </Text>
              )}
            </Flex>
          </Box>
        </Flex>

        {/* Streaming-together (Twitch collab) banner */}
        {collab.length > 0 && (
          <Box
            mb="12px" px="11px" py="10px" borderRadius="9px"
            style={{
              background: "linear-gradient(90deg, rgba(166,108,255,0.14), rgba(91,227,125,0.14))",
              border: "1px solid rgba(166,108,255,0.3)",
            }}
          >
            <Flex align="center" gap="7px" mb="9px">
              <Text fontSize="13px" flex="none">🤝</Text>
              <Text fontSize="12px" fontWeight="600" color="text">
                Streaming together
              </Text>
              {live.length > 0 && (
                <>
                  <Box flex="1" />
                  <Text fontFamily="mono" fontSize="11px" color="muted">
                    {fmt(live.reduce((s, p) => s + p.viewers, 0))} viewers
                  </Text>
                </>
              )}
            </Flex>
            <Flex align="center" gap="7px" wrap="wrap">
              {/* Active channel */}
              <ParticipantChip
                name={name}
                avatar={avatar}
                verified={twitchProfile?.broadcasterType === "partner"}
              />
              {collab.map((c) => (
                <Flex key={c.login} align="center" gap="7px">
                  <Text fontSize="11px" color="faint" flex="none">with</Text>
                  <ParticipantChip name={c.displayName} avatar={c.profileImageUrl} verified={c.verified} />
                </Flex>
              ))}
            </Flex>
          </Box>
        )}

        {/* Per-platform stats */}
        <Flex direction="column" gap="9px">
          {platforms.map((p) => (
            <PlatformSection key={p.platform} p={p} href={hrefFor(p)} />
          ))}
        </Flex>

        {/* Twitch bio */}
        {twitchProfile?.description && (
          <Box mt="13px" pt="13px" borderTopWidth="1px" borderColor="line">
            <Text fontFamily="mono" fontSize="9px" letterSpacing="0.14em" color="faint" mb="5px">
              ABOUT
            </Text>
            <Text fontSize="12.5px" color="muted" lineHeight="1.5" style={{ overflowWrap: "anywhere" }}>
              <MentionText text={twitchProfile.description} />
            </Text>
          </Box>
        )}

        {/* Social media */}
        {socials.length > 0 && (
          <Box mt="13px" pt="13px" borderTopWidth="1px" borderColor="line">
            <Text fontFamily="mono" fontSize="9px" letterSpacing="0.14em" color="faint" mb="8px">
              SOCIALS
            </Text>
            <Flex wrap="wrap" gap="7px">
              {socials.map((s) => (
                <chakra.a
                  key={s.url}
                  href={s.url}
                  target="_blank"
                  rel="noreferrer"
                  display="inline-flex"
                  alignItems="center"
                  gap="6px"
                  px="10px"
                  h="28px"
                  borderRadius="7px"
                  borderWidth="1px"
                  borderColor="fieldLine"
                  bg="bg"
                  fontSize="11.5px"
                  fontWeight="500"
                  color="muted"
                  _hover={{ transform: "none", boxShadow: "none", color: "text", borderColor: "muted" }}
                >
                  {s.title}
                  <Box as="span" color="faint" fontSize="10px">↗</Box>
                </chakra.a>
              ))}
            </Flex>
          </Box>
        )}
      </Box>
    </>
  );
}
