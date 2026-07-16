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

// Center pill — the stream you're tuned into: avatar, name, LIVE state,
// viewers and stream title, live from the stats context. Beacon state folds
// in here: waiting animation when beacon is on with no channel, a steady
// beacon dot when the current selection is beacon-driven.
function ActiveChannelPill() {
  const { activeChannel, activeKick, activeKickOnly, beaconMode } = useChat();
  const { platforms, collab } = useStats();
  const { isMobile } = useLayout();
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
      align="center" px="11px" h="36px"
      borderRadius="9px" borderWidth="1px" borderColor="line"
      bg="panel" maxW="100%" minW="0"
    >
      {/* Inner content clips so a long name/title can never overlap the badges. */}
      <Flex align="center" gap="9px" minW="0" overflow="hidden" flex="1">
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
        display="flex" alignItems="center" gap="4px" flex="none" minW="0" maxW={{ base: "96px", sm: "130px", md: "190px" }}
        bg="transparent" cursor="pointer"
        color="text"
        _hover={{ color: "#fff" }}
      >
        <Text fontSize="13px" fontWeight="600" truncate>
          {name}
        </Text>
        {twitchP?.verified && <VerifiedBadge size={12} title="Verified partner" />}
        {kickP?.verified && (
          <VerifiedBadge size={12} color={PLATFORM_COLOR.kick} title="Verified on Kick" />
        )}
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
              {collab.slice(0, isMobile ? 3 : 2).map((c) => (
                <Flex key={c.login} align="center" gap="3px" flex="none">
                  {c.profileImageUrl && (
                    <chakra.img
                      src={c.profileImageUrl} alt={c.displayName}
                      w="15px" h="15px" borderRadius="full" objectFit="cover"
                      style={c.host ? { boxShadow: "0 0 0 1.5px #A66CFF" } : undefined}
                    />
                  )}
                  {/* Names/roles/viewers collapse to avatars-only on mobile. */}
                  {!isMobile && (
                    <>
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
                    </>
                  )}
                </Flex>
              ))}
              {collab.length > (isMobile ? 3 : 2) && (
                <Text fontFamily="mono" fontSize="10px" color="muted" flex="none">
                  +{collab.length - (isMobile ? 3 : 2)}
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

      {/* Stream title + category — hidden below md to keep the pill compact. */}
      {title && (
        <Flex hideBelow="md" align="center" gap="9px" minW="0" flex="1">
          <Box w="1px" h="16px" bg="line" flex="none" />
          <Text fontSize="12px" color="muted" truncate minW="0" title={title}>
            <MentionText text={title} />
          </Text>
        </Flex>
      )}
      </Flex>

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
  const { chatLayout, setChatLayout, searchOpen, setSearchOpen, setNavOpen, navMode, cycleNavMode, panelMode, togglePanel } = useLayout();
  const [settingsOpen, setSettingsOpen] = useState(false);

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
  }, [setSearchOpen]);

  return (
    <>
      <Flex
        as="header"
        flex="none"
        h="56px"
        align="center"
        gap={{ base: "8px", md: "12px" }}
        px={{ base: "12px", md: "20px" }}
        borderBottomWidth="1px"
        borderColor="line"
      >
        {/* Left: hamburger (mobile only) + prism + brand */}
        <Flex align="center" gap="10px" flex="none">
          <chakra.button
            hideFrom="md"
            type="button"
            onClick={() => setNavOpen(true)}
            aria-label="Open navigation"
            title="Menu"
            display="flex" alignItems="center" justifyContent="center"
            w="34px" h="34px" borderRadius="9px" flex="none"
            bg="transparent" cursor="pointer"
            borderWidth="1px" borderColor="#232a38"
            _hover={{ bg: "raised" }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
              <path d="M2 4h12M2 8h12M2 12h12" stroke="#8B93A7" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </chakra.button>
          {/* Desktop: cycle the sidebar through expanded → rail → hidden. */}
          <chakra.button
            hideBelow="md"
            type="button"
            onClick={cycleNavMode}
            aria-label="Toggle sidebar"
            title={
              navMode === "expanded"
                ? "Collapse sidebar to icons"
                : navMode === "rail"
                  ? "Hide sidebar"
                  : "Show sidebar"
            }
            display="flex" alignItems="center" justifyContent="center"
            w="34px" h="34px" borderRadius="9px" flex="none"
            bg="transparent" cursor="pointer"
            borderWidth="1px" borderColor="#232a38"
            _hover={{ bg: "raised" }}
          >
            <svg
              width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden
              style={{ transform: navMode === "hidden" ? "rotate(180deg)" : "none", transition: "transform .15s" }}
            >
              <path d="M10 3 L5 8 L10 13" stroke="#8B93A7" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </chakra.button>
          <ProfileButton onClick={() => setSettingsOpen(true)} />
          <Text
            hideBelow="sm"
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

        {/* Right: view controls. Per-platform read/send toggles now live solely
            in the composer (a single shared active-set drives both). */}
        <Flex align="center" gap="7px" flex="none">
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

          {/* Desktop: show/hide the right stats panel. */}
          <chakra.button
            hideBelow="md"
            type="button"
            title={panelMode === "hidden" ? "Show stats panel" : "Hide stats panel"}
            aria-label="Toggle stats panel"
            onClick={togglePanel}
            display="flex" alignItems="center" justifyContent="center"
            w="30px" h="30px" borderRadius="7px" flex="none"
            transition="background .12s, border-color .12s"
            style={
              panelMode === "expanded"
                ? { background: "rgba(166,108,255,0.14)", border: "1px solid rgba(166,108,255,0.45)" }
                : { background: "transparent", border: "1px solid #232a38" }
            }
            _hover={{ background: "rgba(166,108,255,0.08)", borderColor: "rgba(166,108,255,0.3)" }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
              <rect x="2" y="3" width="12" height="10" rx="1.5" stroke="#8B93A7" strokeWidth="1.4" />
              <line x1="10.5" y1="3" x2="10.5" y2="13" stroke="#8B93A7" strokeWidth="1.4" />
            </svg>
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
