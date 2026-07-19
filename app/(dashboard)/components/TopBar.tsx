"use client";

import { useState, useEffect } from "react";
import { Flex, Box, Text, chakra } from "@chakra-ui/react";
import { SettingsDialog } from "./SettingsDialog";
import { CommandSearch } from "./CommandSearch";
import { ChannelAbout } from "./ChannelAbout";
import { PlatformIcon, PLATFORM_COLOR } from "./PlatformIcon";
import { BeaconSignal } from "./BeaconSignal";
import { useLayout } from "../_ctx/layout";
import { useChat, useChatSignal } from "../_ctx/chat";
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
// in here: the signal art scans while beacon is armed with no channel (or while
// a beacon-selected channel is still connecting) and holds strong once live.
function ActiveChannelPill() {
  const { activeChannel, activeKick, activeKickOnly, beaconMode } = useChat();
  const signalStatus = useChatSignal();
  const { platforms, collab } = useStats();
  const { isMobile } = useLayout();
  const [aboutOpen, setAboutOpen] = useState(false);

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
        align="center" gap="9px" px="12px" h="28px"
        borderRadius="7px" borderWidth="1px"
        style={{ borderColor: "rgba(56,189,248,0.25)", background: "rgba(56,189,248,0.06)" }}
      >
        <BeaconSignal state="searching" />
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
      {beaconMode && (
        <Box
          flex="none" display="inline-flex"
          title={signalStatus === "connected" ? "Following your beacon" : "Tuning in…"}
        >
          <BeaconSignal state={signalStatus === "connected" ? "strong" : "searching"} />
        </Box>
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

      </Flex>

      {aboutOpen && <ChannelAbout onClose={() => setAboutOpen(false)} />}
    </Flex>
  );
}

// ── Pixel-sprite logo geometry (computed once at module load) ──
const PX = 8; // grid cell — chunky low-res blocks
const PX_GAP = 0.8; // hairline between pixels
const psnap = (v: number) => Math.round(v / PX) * PX;
// Chunky pixel "P" (3×4 grid): bowl on top, stem down.
const P_MATRIX = ["111", "101", "111", "100"];
const P_W = P_MATRIX[0].length;
const P_H = P_MATRIX.length;
const P_OX = 60 - (P_W * PX) / 2;
const P_OY = 60 - (P_H * PX) / 2;
const P_PIXELS: [number, number][] = [];
P_MATRIX.forEach((row, y) =>
  [...row].forEach((v, x) => {
    if (v === "1") P_PIXELS.push([P_OX + x * PX, P_OY + y * PX]);
  })
);
// One tilted orbit, rasterised onto the same grid → a stepped pixel ring.
const O_CX = 60, O_CY = 60, O_RX = 30, O_RY = 11, O_ROT = -18;
const RING_PIXELS: [number, number][] = (() => {
  const rad = (O_ROT * Math.PI) / 180, cs = Math.cos(rad), sn = Math.sin(rad);
  const seen = new Set<string>();
  const out: [number, number][] = [];
  for (let a = 0; a < 360; a += 3) {
    const t = (a * Math.PI) / 180, ex = O_RX * Math.cos(t), ey = O_RY * Math.sin(t);
    const X = psnap(O_CX + ex * cs - ey * sn), Y = psnap(O_CY + ex * sn + ey * cs);
    const k = `${X},${Y}`;
    if (!seen.has(k)) {
      seen.add(k);
      out.push([X, Y]);
    }
  }
  return out;
})();
const ORBIT_PATH = `M${O_CX - O_RX},${O_CY} a${O_RX},${O_RY} 0 1,1 ${2 * O_RX},0 a${O_RX},${O_RY} 0 1,1 ${-2 * O_RX},0`;
const ORBIT_STEPS = RING_PIXELS.length;

// One orbiting electron: a bright pixel head plus a short stepped comet trail,
// travelling the orbit path via CSS steps() so it snaps pixel-to-pixel. Dims and
// pauses when its platform isn't connected.
const TRAIL = 6; // head + 5 trailing pixels
function Electron({
  color,
  durSec,
  delaySec,
  on,
}: {
  color: string;
  durSec: number;
  delaySec: number;
  on: boolean;
}) {
  // One grid step of the animation — offset each trail pixel by this so it lands
  // one cell BEHIND the head (otherwise every trail pixel stacks on the head).
  const stepDur = durSec / ORBIT_STEPS;
  return (
    <g transform={`rotate(${O_ROT} ${O_CX} ${O_CY})`}>
      {Array.from({ length: TRAIL }).map((_, k) => {
        const head = k === 0;
        const s = head ? 1 : 0.78;
        const off = (s * PX) / 2;
        return (
          <rect
            key={k}
            x={-off}
            y={-off}
            width={s * PX}
            height={s * PX}
            fill={color}
            shapeRendering="crispEdges"
            opacity={on ? 1 - k * 0.15 : 0.13}
            style={{
              offsetPath: `path('${ORBIT_PATH}')`,
              offsetRotate: "0deg",
              animationName: "pel-orbit",
              animationDuration: `${durSec}s`,
              animationTimingFunction: `steps(${ORBIT_STEPS}, end)`,
              animationIterationCount: "infinite",
              animationDelay: `${(delaySec - k * stepDur).toFixed(3)}s`,
              animationPlayState: on ? "running" : "paused",
              filter: head ? `drop-shadow(0 0 2px ${color})` : undefined,
            }}
          />
        );
      })}
    </g>
  );
}

// Profile button — the Prismarity mark: a pixel-art "P" with two electrons
// (Twitch violet, Kick green) orbiting it on a stepped pixel ring, each trailing
// a short comet. An electron dims + pauses when its platform isn't connected.
// Opens settings on click.
function ProfileButton({
  onClick,
  connected,
}: {
  onClick: () => void;
  connected: { twitch: boolean; kick: boolean };
}) {
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
        filter: hovered ? "drop-shadow(0 0 3px rgba(166,108,255,0.5))" : "none",
      }}
    >
      <svg width="30" height="30" viewBox="24 24 72 72" fill="none" aria-hidden style={{ overflow: "visible" }}>
        {/* stepped pixel orbit ring, behind the letter */}
        {RING_PIXELS.map(([x, y], i) => (
          <rect key={`r${i}`} x={x} y={y} width={PX - PX_GAP} height={PX - PX_GAP} fill="#7C889E" opacity={0.22} shapeRendering="crispEdges" />
        ))}
        {/* the pixel P */}
        {P_PIXELS.map(([x, y], i) => (
          <rect key={`p${i}`} x={x} y={y} width={PX - PX_GAP} height={PX - PX_GAP} fill="#E9ECF7" shapeRendering="crispEdges" />
        ))}
        {/* the two electrons, on top so they always read */}
        <Electron color={PLATFORM_COLOR.twitch} durSec={5} delaySec={0} on={connected.twitch} />
        <Electron color={PLATFORM_COLOR.kick} durSec={5} delaySec={-2.5} on={connected.kick} />
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
          <ProfileButton
            onClick={() => setSettingsOpen(true)}
            connected={{ twitch: !!auth.twitch, kick: !!auth.kick }}
          />
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
