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

export type AuthInfo = { twitch: { displayName: string } | null; kick: { displayName: string } | null; youtube: { displayName: string } | null };

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

  // The tuned streamer's OWN YouTube channel, pulled from their Twitch About-
  // panel social links (GQL) — same "same person, across platforms" idea as the
  // Twitch/Kick icons. Link only; we don't fetch YouTube live status here.
  const streamerLogin = activeChannel?.login ?? null;
  const [streamerYouTube, setStreamerYouTube] = useState<string | null>(null);
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    setStreamerYouTube(null);
    if (!streamerLogin) return;
    /* eslint-enable react-hooks/set-state-in-effect */
    let cancelled = false;
    fetch(`/api/twitch/socials?login=${encodeURIComponent(streamerLogin)}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { socials?: { name: string; title: string; url: string }[] } | null) => {
        if (cancelled || !j?.socials) return;
        const yt = j.socials.find(
          (s) => /youtube\.com|youtu\.be/i.test(s.url) || /youtube/i.test(s.name)
        );
        setStreamerYouTube(yt?.url ?? null);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [streamerLogin]);

  // Whether that YouTube channel is live right now (scrape-based, best-effort —
  // /api/youtube/live). Lets the YouTube icon light up on live like Twitch/Kick;
  // any failure just reads as offline, so it degrades to a muted link.
  const [streamerYouTubeLive, setStreamerYouTubeLive] = useState(false);
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    setStreamerYouTubeLive(false);
    if (!streamerYouTube) return;
    /* eslint-enable react-hooks/set-state-in-effect */
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(`/api/youtube/live?url=${encodeURIComponent(streamerYouTube!)}`, { cache: "no-store" });
        if (!res.ok) return;
        const j = (await res.json()) as { live?: boolean };
        if (!cancelled) setStreamerYouTubeLive(!!j.live);
      } catch {
        /* ignore — stays offline */
      }
    }
    load();
    const id = setInterval(load, 60_000);
    return () => { cancelled = true; clearInterval(id); };
  }, [streamerYouTube]);

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

  // Stats rows exist per platform feed the selection spans. YouTube is the
  // connected account's OWN channel (not part of the tuned Twitch/Kick
  // selection), so it's excluded from the pill.
  const tuned = platforms.filter((p) => p.platform !== "youtube");
  const live = tuned.filter((p) => p.isLive);
  const isLive = live.length > 0;
  const name =
    activeChannel?.displayName ?? tuned[0]?.channelName ?? activeKickOnly!;
  const avatar =
    (isLive ? live : tuned).find((p) => p.profileImageUrl)?.profileImageUrl ?? null;
  const viewers = live.reduce((sum, p) => sum + p.viewers, 0);

  // Per-platform live state — each icon lights up in the platform's brand color
  // only when the streamer is actually LIVE there; offline → dim grey. (YouTube
  // has no live signal available, so it stays a muted link — see below.)
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
        {streamerYouTube && (
          // The tuned streamer's YouTube (from their Twitch socials). Lights up
          // brand-red when they're live on YouTube (scrape-based), dim grey when
          // offline/unknown — same live-based rule as the Twitch/Kick icons.
          <chakra.a
            href={streamerYouTube}
            target="_blank" rel="noreferrer"
            title={`Open ${name} on YouTube${streamerYouTubeLive ? " (live)" : ""}`}
            onClick={(e: React.MouseEvent) => e.stopPropagation()}
            display="inline-flex" flex="none"
            transition="opacity .12s"
            _hover={{ transform: "none", boxShadow: "none", opacity: 0.6 }}
          >
            <PlatformIcon platform="youtube" color={streamerYouTubeLive ? PLATFORM_COLOR.youtube : "#3a4152"} size={12} />
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
// Chunky pixel "P" (3×4 grid): bowl on top, stem down — the atom's nucleus.
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
// Grid-snap helper — rasterises an orbit onto the same pixel grid as the letter.
const psnap = (v: number) => Math.round(v / PX) * PX;

// Three orbits tilted like an atom: Twitch on the "\" diagonal, Kick on the "/"
// diagonal, YouTube vertical (top↔bottom). Each has its OWN ellipse (rx×ry) so
// the tilted pair (Twitch/Kick) and the vertical one nest cleanly — tuned in the
// orbit tuner. Each ellipse is rasterised at its tilt into a stepped pixel ring;
// a comet snaps along it.
const YOUTUBE_COLOR = "#FF3D46";

function orbitPath(rx: number, ry: number): string {
  return `M${60 - rx},60 a${rx},${ry} 0 1,1 ${2 * rx},0 a${rx},${ry} 0 1,1 ${-2 * rx},0`;
}

function rasterizeRing(rot: number, rx: number, ry: number): [number, number][] {
  const rad = (rot * Math.PI) / 180, cs = Math.cos(rad), sn = Math.sin(rad);
  const seen = new Set<string>();
  const out: [number, number][] = [];
  for (let a = 0; a < 360; a += 3) {
    const t = (a * Math.PI) / 180, ex = rx * Math.cos(t), ey = ry * Math.sin(t);
    const X = psnap(60 + ex * cs - ey * sn), Y = psnap(60 + ex * sn + ey * cs);
    const k = `${X},${Y}`;
    if (!seen.has(k)) {
      seen.add(k);
      out.push([X, Y]);
    }
  }
  return out;
}

// Per-orbit ellipse + phase, tuned in the orbit tuner so the comets converge on
// the vertical midline above the P. delaySec is the top-centre crossing phase ×
// the 5s lap. Kick `reverse`s its spin so Twitch and Kick counter-rotate (mirror)
// through their shared meeting point instead of tracking in lockstep — reversing
// flips its phase, so its delay is the reverse-equivalent of the tuner's value.
const ORBITS = [
  { platform: "twitch" as const, color: PLATFORM_COLOR.twitch, rot: 45, rx: 32, ry: 11.75, delaySec: -4.130, reverse: false },
  { platform: "kick" as const, color: PLATFORM_COLOR.kick, rot: -45, rx: 32, ry: 11.75, delaySec: -1.630, reverse: true },
  { platform: "youtube" as const, color: YOUTUBE_COLOR, rot: 90, rx: 26, ry: 9.55, delaySec: 0, reverse: false },
].map((o) => {
  const ring = rasterizeRing(o.rot, o.rx, o.ry);
  return { ...o, ring, steps: ring.length, path: orbitPath(o.rx, o.ry) };
});

// One orbiting particle: a bright pixel head plus a short stepped comet trail,
// travelling its tilted orbit via CSS steps() so it snaps pixel-to-pixel. Dims
// and pauses when its platform isn't connected.
const TRAIL = 6; // head + 5 trailing pixels
function Electron({
  color,
  rot,
  steps,
  durSec,
  delaySec,
  path,
  reverse,
}: {
  color: string;
  rot: number;
  steps: number;
  durSec: number;
  delaySec: number;
  path: string;
  reverse: boolean;
}) {
  const stepDur = durSec / steps;
  return (
    <g transform={`rotate(${rot} 60 60)`}>
      {Array.from({ length: TRAIL }).map((_, k) => {
        const head = k === 0;
        const s = head ? 1 : 0.78;
        const off = (s * PX) / 2;
        // The trail sits BEHIND the head along its direction of travel: earlier
        // in the animation for a forward spin, later for a reversed one.
        const trailDelay = reverse ? delaySec + k * stepDur : delaySec - k * stepDur;
        return (
          <rect
            key={k}
            x={-off}
            y={-off}
            width={s * PX}
            height={s * PX}
            fill={color}
            shapeRendering="crispEdges"
            opacity={1 - k * 0.15}
            style={{
              offsetPath: `path('${path}')`,
              offsetRotate: "0deg",
              animationName: "pel-orbit",
              animationDuration: `${durSec}s`,
              animationTimingFunction: `steps(${steps}, end)`,
              animationIterationCount: "infinite",
              animationDirection: reverse ? "reverse" : "normal",
              animationDelay: `${trailDelay.toFixed(3)}s`,
              filter: head ? `drop-shadow(0 0 2px ${color})` : undefined,
            }}
          />
        );
      })}
    </g>
  );
}

// Profile button — the Prismarity mark: a bold pixel-art "P" nucleus with a
// colored comet (Twitch "\", Kick "/", YouTube vertical) orbiting it for each
// CONNECTED platform. No faint/grey rings — scattered low-opacity pixels read as
// noise and hurt readability at this size; a platform that isn't connected
// simply shows nothing. Opens settings on click.
function ProfileButton({
  onClick,
  connected,
}: {
  onClick: () => void;
  connected: { twitch: boolean; kick: boolean; youtube: boolean };
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
        {/* the bold pixel P nucleus — the whole mark when nothing is connected */}
        {P_PIXELS.map(([x, y], i) => (
          <rect key={`p${i}`} x={x} y={y} width={PX - PX_GAP} height={PX - PX_GAP} fill="#E9ECF7" shapeRendering="crispEdges" />
        ))}
        {/* one colored comet per CONNECTED platform — nothing shown otherwise */}
        {ORBITS.map((o) =>
          !connected[o.platform] ? null : (
            <Electron
              key={`e-${o.platform}`}
              color={o.color}
              rot={o.rot}
              steps={o.steps}
              durSec={5}
              delaySec={o.delaySec}
              path={o.path}
              reverse={o.reverse}
            />
          )
        )}
      </svg>
    </chakra.button>
  );
}

interface TopBarProps {
  auth: AuthInfo;
}

export function TopBar({ auth }: TopBarProps) {
  const { chatLayout, setChatLayout, searchOpen, setSearchOpen, setNavOpen, navMode, cycleNavMode, panelMode, togglePanel, isMobile, setPanelOpen } = useLayout();
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
            connected={{ twitch: !!auth.twitch, kick: !!auth.kick, youtube: !!auth.youtube }}
          />
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

          {/* Desktop: show/hide the docked stats panel. Mobile: open it as an
              overlay drawer that takes over the chat (like the NavRail drawer). */}
          <chakra.button
            type="button"
            title={isMobile ? "Show stats panel" : panelMode === "hidden" ? "Show stats panel" : "Hide stats panel"}
            aria-label="Toggle stats panel"
            onClick={() => (isMobile ? setPanelOpen(true) : togglePanel())}
            display="flex" alignItems="center" justifyContent="center"
            w="30px" h="30px" borderRadius="7px" flex="none"
            transition="background .12s, border-color .12s"
            style={
              !isMobile && panelMode === "expanded"
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
