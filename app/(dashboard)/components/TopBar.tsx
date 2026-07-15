"use client";

import { useState, useEffect } from "react";
import { Flex, Box, Text, chakra } from "@chakra-ui/react";
import { SettingsDialog } from "./SettingsDialog";
import { CommandSearch } from "./CommandSearch";
import { ChannelAbout } from "./ChannelAbout";
import { MentionText } from "./MentionText";
import { PlatformIcon, PLATFORM_COLOR, VerifiedBadge } from "./PlatformIcon";
import { useLayout } from "../_ctx/layout";
import { useChat } from "../_ctx/chat";
import { useSession } from "../_ctx/session";
import { useStats } from "../_ctx/stats";

export type AuthInfo = { twitch: { displayName: string } | null; kick: { displayName: string } | null };

function CombinedIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="#8B93A7" aria-hidden>
      <rect x="2" y="3"  width="12" height="2" rx="1" />
      <rect x="2" y="7"  width="12" height="2" rx="1" />
      <rect x="2" y="11" width="12" height="2" rx="1" />
    </svg>
  );
}

function SplitIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="rgba(166,108,255,0.9)" aria-hidden>
      <rect x="1" y="2" width="6" height="12" rx="1.5" />
      <rect x="9" y="2" width="6" height="12" rx="1.5" />
    </svg>
  );
}

// Platform badge — a chat filter toggle (same behavior as the old sidebar
// chips). Prominent icon + label chip: glows in the platform color when that
// chat is shown, ghosts out when hidden. Unconnected platforms open settings.
function PlatformBadge({
  platform,
  connected,
  on,
  accountName,
  isLive,
  onToggle,
  onConnect,
}: {
  platform: "twitch" | "kick";
  connected: boolean;
  on: boolean;
  accountName: string | null;
  isLive: boolean;
  onToggle: () => void;
  onConnect: () => void;
}) {
  const color = PLATFORM_COLOR[platform];
  const label = platform === "twitch" ? "TWITCH" : "KICK";

  return (
    <chakra.button
      type="button"
      onClick={connected ? onToggle : onConnect}
      title={
        connected
          ? `${accountName} — ${on ? "hide" : "show"} ${label.toLowerCase()} chat`
          : `${label.toLowerCase()} not connected — open settings to connect`
      }
      position="relative"
      display="flex" alignItems="center" gap="7px"
      px="11px" h="30px" borderRadius="8px" flex="none"
      cursor="pointer"
      transition="background .15s, border-color .15s, box-shadow .2s, opacity .15s"
      style={
        !connected
          ? { background: "transparent", border: "1px solid #232a38", opacity: 0.3 }
          : on
            ? {
                background: `${color}1E`,
                border: `1px solid ${color}`,
                boxShadow: `0 0 14px ${color}45, inset 0 0 10px ${color}12`,
              }
            : { background: "transparent", border: "1px solid #2a3244", opacity: 0.55 }
      }
      _hover={connected ? { background: `${color}28` } : { opacity: 0.55 }}
    >
      <PlatformIcon platform={platform} color={connected && on ? color : "#8B93A7"} size={13} />
      <Text
        as="span"
        fontFamily="mono"
        fontSize="10px"
        fontWeight="700"
        letterSpacing="0.12em"
        style={{ color: connected && on ? color : "#5C6479" }}
      >
        {label}
      </Text>
      {connected && isLive && (
        <Box
          position="absolute" top="-3px" right="-3px"
          w="8px" h="8px" borderRadius="full" bg="#FF5C5C"
          borderWidth="2px" borderColor="bg"
        />
      )}
    </chakra.button>
  );
}

// Center pill — the stream you're tuned into: avatar, name, LIVE state,
// viewers and stream title, live from the stats context. Beacon state folds
// in here: waiting animation when beacon is on with no channel, a steady
// beacon dot when the current selection is beacon-driven.
function ActiveChannelPill() {
  const { activeChannel, activeKick, activeKickOnly, beaconMode } = useChat();
  const { platforms, collab } = useStats();
  const [beaconSignal, setBeaconSignal] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);

  useEffect(() => {
    if (!beaconMode) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setBeaconSignal(false);
      return;
    }
    let cancelled = false;
    async function poll() {
      try {
        const res = await fetch("/api/beacon");
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as { platform?: string; channel?: string };
        if (!cancelled) setBeaconSignal(!!data.platform && !!data.channel);
      } catch { /* silent */ }
    }
    poll();
    const id = setInterval(poll, 3000);
    return () => { cancelled = true; clearInterval(id); };
  }, [beaconMode]);

  const hasSelection = !!activeChannel || !!activeKickOnly;

  if (!hasSelection) {
    if (!beaconMode) {
      return (
        <Text fontSize="12px" color="faint" letterSpacing="0.04em">
          no channel
        </Text>
      );
    }
    // Beacon armed, waiting for the extension to report a stream.
    return (
      <Flex
        align="center" gap="8px" px="12px" h="28px"
        borderRadius="7px" borderWidth="1px"
        style={{ borderColor: "rgba(56,189,248,0.25)", background: "rgba(56,189,248,0.06)" }}
      >
        <Box position="relative" w="7px" h="7px" flex="none">
          <Box
            position="absolute" inset="0" borderRadius="full"
            style={{ background: "rgba(56,189,248,0.9)", animation: "beacon-pulse 1.6s ease-in-out infinite" }}
          />
          <Box
            position="absolute" inset="-3px" borderRadius="full"
            style={{ background: "rgba(56,189,248,0.25)", animation: "beacon-ring 1.6s ease-out infinite" }}
          />
        </Box>
        <Text fontSize="12px" fontWeight="500" style={{ color: "rgba(56,189,248,0.75)" }}>
          Waiting for signal...
        </Text>
      </Flex>
    );
  }

  // Stats rows exist per platform feed the selection spans.
  const live = platforms.filter((p) => p.isLive);
  const isLive = live.length > 0;
  const name =
    activeChannel?.displayName ?? platforms[0]?.channelName ?? activeKickOnly!;
  const avatar =
    (isLive ? live : platforms).find((p) => p.profileImageUrl)?.profileImageUrl ?? null;
  const viewers = live.reduce((sum, p) => sum + p.viewers, 0);
  // Only a LIVE platform's own title/category is shown — never one platform's
  // logo paired with another's description.
  const desc = live.find((p) => p.title || p.category);
  const title = desc
    ? `${desc.title || "—"}${desc.category ? ` · ${desc.category}` : ""}`
    : "";

  // Per-platform presence + live state. The icon lights up in the platform's
  // color only when it is actually live there; a present-but-offline platform
  // is dimmed so it never implies a stream that isn't happening.
  const twitchP = platforms.find((p) => p.platform === "twitch");
  const kickP = platforms.find((p) => p.platform === "kick");
  const twitchLogin = activeChannel?.login ?? null;
  const kickSlug = activeKick?.slug ?? activeKickOnly ?? null;

  return (
    <Flex
      position="relative"
      align="center" gap="9px" px="11px" h="36px"
      borderRadius="9px" borderWidth="1px" borderColor="line"
      bg="panel" maxW="100%" minW="0"
    >
      {beaconMode && beaconSignal && (
        <Box
          w="6px" h="6px" borderRadius="full" flex="none"
          title="Following your beacon"
          style={{ background: "rgba(56,189,248,0.9)" }}
        />
      )}

      {/* Profile pic */}
      {avatar ? (
        <chakra.img
          src={avatar} alt={name}
          w="24px" h="24px" borderRadius="full" objectFit="cover" flex="none"
        />
      ) : (
        <Flex
          w="24px" h="24px" borderRadius="full" bg="raised" flex="none"
          align="center" justify="center" fontSize="10px" fontWeight="700" color="muted"
        >
          {name[0]?.toUpperCase()}
        </Flex>
      )}

      {/* Platform icons — click to open that channel in a new tab. */}
      <Flex align="center" gap="6px" flex="none">
        {twitchP && (
          <chakra.a
            href={twitchLogin ? `https://twitch.tv/${twitchLogin}` : undefined}
            target="_blank" rel="noreferrer"
            title={`Open ${name} on Twitch${twitchP.isLive ? " (live)" : ""}`}
            onClick={(e: React.MouseEvent) => e.stopPropagation()}
            display="inline-flex" flex="none"
            transition="opacity .12s"
            _hover={{ transform: "none", boxShadow: "none", opacity: 0.6 }}
          >
            <PlatformIcon platform="twitch" color={twitchP.isLive ? PLATFORM_COLOR.twitch : "#3a4152"} size={13} />
          </chakra.a>
        )}
        {kickP && (
          <chakra.a
            href={kickSlug ? `https://kick.com/${kickSlug}` : undefined}
            target="_blank" rel="noreferrer"
            title={`Open ${name} on Kick${kickP.isLive ? " (live)" : ""}`}
            onClick={(e: React.MouseEvent) => e.stopPropagation()}
            display="inline-flex" flex="none"
            transition="opacity .12s"
            _hover={{ transform: "none", boxShadow: "none", opacity: 0.6 }}
          >
            <PlatformIcon platform="kick" color={kickP.isLive ? PLATFORM_COLOR.kick : "#3a4152"} size={12} />
          </chakra.a>
        )}
      </Flex>

      {/* Name — click to open the About card. */}
      <chakra.button
        type="button"
        onClick={() => setAboutOpen((o) => !o)}
        title="View channel info"
        display="flex" alignItems="center" gap="4px" flex="none" maxW="190px"
        bg="transparent" cursor="pointer"
        color="text"
        _hover={{ color: "#fff" }}
      >
        <Text fontSize="13px" fontWeight="600" truncate>
          {name}
        </Text>
        {twitchP?.verified && <VerifiedBadge size={12} title="Verified partner" />}
      </chakra.button>

      {isLive ? (
        <Flex align="center" gap="5px" flex="none">
          <Box
            w="6px" h="6px" borderRadius="full" bg="#FF5C5C"
            animation="pris-pulse 1.4s ease-in-out infinite"
          />
          <Text fontFamily="mono" fontSize="10px" fontWeight="600" color="#FF5C5C">
            LIVE
          </Text>
          {collab.length > 0 && (
            <Flex
              align="center" gap="5px" flex="none"
              pl="6px" pr="7px" py="1px" borderRadius="5px"
              style={{
                background: "linear-gradient(90deg, rgba(166,108,255,0.16), rgba(91,227,125,0.16))",
                border: "1px solid rgba(166,108,255,0.35)",
              }}
              title={`Streaming together with ${collab.map((c) => c.displayName).join(", ")}`}
            >
              <Text fontFamily="mono" fontSize="8px" fontWeight="700" letterSpacing="0.1em" color="faint" flex="none">
                WITH
              </Text>
              {collab.slice(0, 2).map((c) => (
                <Flex key={c.login} align="center" gap="3px" flex="none">
                  {c.profileImageUrl && (
                    <chakra.img
                      src={c.profileImageUrl} alt={c.displayName}
                      w="15px" h="15px" borderRadius="full" objectFit="cover"
                      style={c.host ? { boxShadow: "0 0 0 1.5px #A66CFF" } : undefined}
                    />
                  )}
                  <Text fontSize="11px" fontWeight="600" color="text">
                    {c.displayName}
                  </Text>
                  {c.host && (
                    <Text fontFamily="mono" fontSize="8px" fontWeight="700" letterSpacing="0.05em" color="#A66CFF" flex="none" title="Stream Together host">
                      HOST
                    </Text>
                  )}
                  {c.verified && <VerifiedBadge size={11} title="Verified partner" />}
                  {c.viewers != null && (
                    <Text fontFamily="mono" fontSize="10px" color="muted" flex="none">
                      {c.viewers.toLocaleString()}
                    </Text>
                  )}
                </Flex>
              ))}
              {collab.length > 2 && (
                <Text fontFamily="mono" fontSize="10px" color="muted" flex="none">
                  +{collab.length - 2}
                </Text>
              )}
            </Flex>
          )}
          <Text fontFamily="mono" fontSize="11px" color="muted">
            {viewers.toLocaleString()}
          </Text>
        </Flex>
      ) : (
        <Text fontFamily="mono" fontSize="10px" color="faint" flex="none">
          offline
        </Text>
      )}

      {/* Stream title + category */}
      {title && (
        <>
          <Box w="1px" h="16px" bg="line" flex="none" />
          <Text fontSize="12px" color="muted" truncate minW="0" title={title}>
            <MentionText text={title} />
          </Text>
        </>
      )}

      {aboutOpen && <ChannelAbout onClose={() => setAboutOpen(false)} />}
    </Flex>
  );
}

// Profile button — prism icon that emits a rainbow aura on hover, opens settings on click.
function ProfileButton({ onClick }: { onClick: () => void }) {
  const [hovered, setHovered] = useState(false);

  return (
    <chakra.button
      type="button"
      onClick={onClick}
      title="Account & settings"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      display="flex"
      alignItems="center"
      justifyContent="center"
      w="34px"
      h="34px"
      borderRadius="9px"
      flex="none"
      borderWidth="1px"
      bg="transparent"
      cursor="pointer"
      transition="filter .3s ease, border-color .2s, background .12s"
      style={{
        borderColor: hovered ? "rgba(166,108,255,0.5)" : "#232a38",
        filter: hovered
          ? "drop-shadow(0 0 3px rgba(166,108,255,1)) drop-shadow(0 0 8px rgba(91,227,125,0.7)) drop-shadow(0 0 16px rgba(56,189,248,0.5)) drop-shadow(0 0 26px rgba(250,204,21,0.25))"
          : "none",
      }}
    >
      <svg width="16" height="18" viewBox="0 0 16 18" fill="none" aria-hidden>
        <path
          d="M8 1 L1 17 L15 17 Z"
          fill="#171B26"
          stroke={hovered ? "rgba(200,185,255,0.75)" : "rgba(80,90,110,0.8)"}
          strokeWidth="1.1"
          strokeLinejoin="round"
          style={{ transition: "stroke .2s" }}
        />
        <line x1="8" y1="1" x2="1" y2="17" stroke="rgba(255,255,255,0.06)" strokeWidth="0.6" />
        <line x1="8" y1="1" x2="15" y2="17" stroke="rgba(255,255,255,0.04)" strokeWidth="0.6" />
        {hovered && (
          <>
            <circle cx="8"    cy="1.5"  r="1.4" fill="rgba(230,210,255,0.95)" />
            <circle cx="1.5"  cy="16.5" r="1.1" fill="rgba(56,189,248,0.9)"  />
            <circle cx="14.5" cy="16.5" r="1.1" fill="rgba(91,227,125,0.9)"  />
          </>
        )}
      </svg>
    </chakra.button>
  );
}

interface TopBarProps {
  auth: AuthInfo;
}

export function TopBar({ auth }: TopBarProps) {
  const { chatLayout, setChatLayout } = useLayout();
  const { ownChannel, ownKick } = useChat();
  const { activeFilters, toggleFilter, connectedPlatforms } = useSession();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  // ⌘K / Ctrl+K opens the channel search.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen((o) => !o);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      <Flex
        as="header"
        flex="none"
        h="56px"
        align="center"
        gap="12px"
        px="20px"
        borderBottomWidth="1px"
        borderColor="line"
      >
        {/* Left: prism + brand */}
        <Flex align="center" gap="10px" flex="none">
          <ProfileButton onClick={() => setSettingsOpen(true)} />
          <Text
            fontFamily="mono"
            fontSize="13px"
            fontWeight="700"
            letterSpacing="0.18em"
            color="text"
            flex="none"
          >
            PRISMARITY
          </Text>
        </Flex>

        {/* Center: what you're tuned into */}
        <Flex flex="1" justify="center" align="center" minW="0">
          <ActiveChannelPill />
        </Flex>

        {/* Right: platform chat toggles + split view */}
        <Flex align="center" gap="7px" flex="none">
          <PlatformBadge
            platform="twitch"
            connected={connectedPlatforms.has("twitch")}
            on={activeFilters.has("twitch")}
            accountName={auth.twitch?.displayName ?? null}
            isLive={ownChannel?.isLive ?? false}
            onToggle={() => toggleFilter("twitch")}
            onConnect={() => setSettingsOpen(true)}
          />
          <PlatformBadge
            platform="kick"
            connected={connectedPlatforms.has("kick")}
            on={activeFilters.has("kick")}
            accountName={auth.kick?.displayName ?? null}
            isLive={ownKick?.isLive ?? false}
            onToggle={() => toggleFilter("kick")}
            onConnect={() => setSettingsOpen(true)}
          />

          <Box w="1px" h="20px" bg="line" mx="3px" flex="none" />

          <chakra.button
            type="button"
            title={chatLayout === "combined" ? "Switch to split view" : "Switch to combined view"}
            onClick={() => setChatLayout(chatLayout === "combined" ? "split" : "combined")}
            display="flex" alignItems="center" justifyContent="center"
            w="30px" h="30px" borderRadius="7px" flex="none"
            transition="background .12s, border-color .12s"
            style={
              chatLayout === "split"
                ? { background: "rgba(166,108,255,0.14)", border: "1px solid rgba(166,108,255,0.45)" }
                : { background: "transparent", border: "1px solid #232a38" }
            }
            _hover={{ background: "rgba(166,108,255,0.08)", borderColor: "rgba(166,108,255,0.3)" }}
          >
            {chatLayout === "combined" ? <CombinedIcon /> : <SplitIcon />}
          </chakra.button>
        </Flex>
      </Flex>

      <CommandSearch open={searchOpen} onClose={() => setSearchOpen(false)} />

      {settingsOpen && (
        <SettingsDialog auth={auth} onClose={() => setSettingsOpen(false)} />
      )}
    </>
  );
}
