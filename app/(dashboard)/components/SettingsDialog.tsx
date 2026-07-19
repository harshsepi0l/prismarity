"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Box, Flex, Text, chakra } from "@chakra-ui/react";
import { PlatformIcon } from "./PlatformIcon";
import { BeaconSignal } from "./BeaconSignal";
import { clearSessionScopedStorage } from "@/lib/clientStorage";
import { useChat, useChatSignal } from "../_ctx/chat";
import { useLayout } from "../_ctx/layout";

const C = {
  bg: "#0E1118",
  panel: "#171B26",
  raised: "#1F2532",
  field: "#12161F",
  line: "#1B2130",
  fieldLine: "#232A38",
  text: "#D6DAE6",
  muted: "#8B93A7",
  faint: "#5C6479",
  twitch: "#A66CFF",
  kick: "#5BE37D",
  youtube: "#FF5C5C",
};

// Platforms with an interactive connect/disconnect flow in Settings.
type ConnectPlatform = "twitch" | "kick" | "youtube";

const PERSON_ICON = (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <path d="M7.5 6.5C7.5 8.981 9.519 11 12 11s4.5-2.019 4.5-4.5S14.481 2 12 2 7.5 4.019 7.5 6.5zM20 21h1v-1c0-3.859-3.141-7-7-7h-4c-3.86 0-7 3.141-7 7v1h17z" />
  </svg>
);

const CHAT_ICON = (
  <Box w="13px" h="10px" flex="none" borderWidth="1.5px" borderStyle="solid" borderColor="currentColor" borderRadius="3px 3px 3px 1px" />
);

const INFO_ICON = (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <path d="M12 2C6.486 2 2 6.486 2 12s4.486 10 10 10 10-4.486 10-10S17.514 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" />
  </svg>
);

// Beacon icon — a dot with two broadcast arcs, used in both the settings panel
// and the companion browser extension.
export const BEACON_ICON_SVG = `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <circle cx="12" cy="18" r="2.5" fill="currentColor"/>
  <path d="M7.5 13.5a6.5 6.5 0 019 0" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
  <path d="M4 9.5a11 11 0 0116 0" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
</svg>`;

function BeaconIcon({ size = 20, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="18" r="2.5" fill={color} />
      <path d="M7.5 13.5a6.5 6.5 0 019 0" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <path d="M4 9.5a11 11 0 0116 0" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

type Category = "accounts" | "chat" | "about";

interface Props {
  auth: {
    twitch: { displayName: string } | null;
    kick: { displayName: string } | null;
    youtube: { displayName: string } | null;
  };
  onClose: () => void;
}


function PlatformSection({
  platform,
  color,
  displayName,
  disconnecting,
  onDisconnect,
  onConnect,
}: {
  platform: ConnectPlatform;
  color: string;
  displayName: string | null;
  disconnecting: ConnectPlatform | null;
  onDisconnect: (p: ConnectPlatform) => void;
  onConnect: () => void;
}) {
  const label =
    platform === "twitch" ? "Twitch" : platform === "kick" ? "Kick" : "YouTube";

  return (
    <Box mb="8px">
      {displayName ? (
        <Flex
          align="center"
          gap="8px"
          px="10px"
          py="9px"
          borderRadius="8px"
          style={{ background: C.raised }}
        >
          <PlatformIcon platform={platform} size={13} />
          <Text fontSize="12px" style={{ color: C.text }}>
            Connected as{" "}
            <Text as="span" fontWeight="600">{displayName}</Text>
          </Text>
          <chakra.button
            type="button"
            onClick={() => onDisconnect(platform)}
            disabled={disconnecting !== null}
            ml="auto"
            px="9px"
            py="4px"
            borderRadius="5px"
            fontSize="11px"
            cursor={disconnecting !== null ? "default" : "pointer"}
            style={{
              color: C.faint,
              border: `1px solid ${C.fieldLine}`,
              background: "transparent",
              transition: "all .15s",
            }}
          >
            {disconnecting === platform ? "…" : "Disconnect"}
          </chakra.button>
        </Flex>
      ) : (
        <chakra.button
          type="button"
          onClick={onConnect}
          display="flex"
          alignItems="center"
          justifyContent="center"
          gap="8px"
          w="full"
          py="10px"
          borderRadius="8px"
          fontSize="13px"
          fontWeight="700"
          cursor="pointer"
          transition="filter .12s"
          _hover={{ filter: "brightness(1.1)" }}
          style={{ background: color, color: "#0E1118" }}
        >
          <PlatformIcon platform={platform} color="#0E1118" size={14} />
          Connect with {label}
        </chakra.button>
      )}
    </Box>
  );
}

export function SettingsDialog({ auth, onClose }: Props) {
  const router = useRouter();
  const [category, setCategory] = useState<Category>("accounts");
  const [disconnecting, setDisconnecting] = useState<ConnectPlatform | null>(null);
  const { beaconMode, setBeaconMode } = useChat();
  const signalStatus = useChatSignal();
  const { isCompact } = useLayout();
  // Desktop: anchored dropdown under the prism. Mobile/tablet: centered modal.
  const asDropdown = !isCompact;

  // Flip on the next frame so the panel animates open (scale/slide/fade). The
  // dropdown grows from its top-left corner — i.e. out of the prism icon.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  // Beacon on but still no stream detected after a grace period → most likely
  // the extension isn't installed (or nothing's open). Only arm while truly
  // idle — a detected stream that's mid-connect (or errored) isn't the
  // extension's fault, so it must not trip this hint.
  const [stalled, setStalled] = useState(false);
  useEffect(() => {
    if (!beaconMode || signalStatus !== "idle") return;
    const id = setTimeout(() => setStalled(true), 6000);
    // Reset on the way out (beacon toggled off, or a signal arrived).
    return () => { clearTimeout(id); setStalled(false); };
  }, [beaconMode, signalStatus]);

  // Beacon pairing token, fetched from the server (derived from SESSION_SECRET,
  // so it can't be computed client-side). Paste-once into the extension popup.
  const [pairToken, setPairToken] = useState<string | null>(null);
  const [pairCopied, setPairCopied] = useState(false);
  const [pairRevealed, setPairRevealed] = useState(false);
  useEffect(() => {
    let alive = true;
    fetch("/api/beacon/pair")
      .then((r) => (r.ok ? r.json() : { token: null }))
      .then((d: { token?: string | null }) => { if (alive) setPairToken(d.token ?? null); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);
  const copyPairToken = useCallback(() => {
    if (!pairToken) return;
    navigator.clipboard?.writeText(pairToken).then(() => {
      setPairCopied(true);
      setTimeout(() => setPairCopied(false), 1500);
    }).catch(() => {});
  }, [pairToken]);
  const [pairRotating, setPairRotating] = useState(false);
  const rotatePairToken = useCallback(() => {
    if (pairRotating) return;
    if (!window.confirm("Regenerate the pairing key? Your extension will stop syncing until you paste the new key into it.")) return;
    setPairRotating(true);
    fetch("/api/beacon/pair", { method: "POST" })
      .then((r) => (r.ok ? r.json() : { token: null }))
      .then((d: { token?: string | null }) => {
        setPairToken(d.token ?? null);
        setPairRevealed(true); // reveal the fresh key so it can be re-pasted
      })
      .catch(() => {})
      .finally(() => setPairRotating(false));
  }, [pairRotating]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const openPopup = useCallback((platform: ConnectPlatform) => {
    const popup = window.open(
      `/api/auth/${platform}/login?popup=1`,
      "prismarity_auth",
      "width=520,height=680,menubar=no,toolbar=no,location=no,status=no"
    );
    // Popup blocked (returns null, or a closed/undefined window) — fall back to a
    // full-page redirect so the button always does *something* instead of looking
    // dead. This flow returns to /chat instead of the popup's /auth/success.
    if (!popup || popup.closed || typeof popup.closed === "undefined") {
      window.location.href = `/api/auth/${platform}/login`;
      return;
    }
    const handler = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return;
      if (e.data?.type === "prismarity_auth_success" || e.data?.type === "prismarity_auth_error") {
        window.removeEventListener("message", handler);
        router.refresh();
      }
    };
    window.addEventListener("message", handler);
  }, [router]);

  const disconnect = useCallback(async (platform: ConnectPlatform) => {
    setDisconnecting(platform);
    try {
      const res = await fetch("/api/auth/disconnect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform }),
      });
      let loggedOut = false;
      try {
        loggedOut = !!((await res.json()) as { loggedOut?: boolean }).loggedOut;
      } catch {
        /* ignore malformed body */
      }
      if (loggedOut) {
        // Full logout: drop the session's watched channels + chat prefs and
        // hard-reload so no in-memory state carries into the logged-out view.
        clearSessionScopedStorage();
        window.location.assign("/chat");
        return;
      }
      router.refresh();
    } finally {
      setDisconnecting(null);
    }
  }, [router]);

  const CATEGORIES: { id: Category; label: string; icon: React.ReactNode }[] = [
    { id: "accounts", label: "Accounts", icon: PERSON_ICON },
    { id: "chat", label: "Chat", icon: CHAT_ICON },
    { id: "about", label: "About", icon: INFO_ICON },
  ];

  return (
    <>
      <Box
        position="fixed"
        inset="0"
        zIndex={200}
        onClick={onClose}
        style={
          asDropdown
            ? { background: "transparent" }
            : { background: "rgba(0,0,0,0.6)", backdropFilter: "blur(3px)" }
        }
      />

      <Box
        position="fixed"
        top={asDropdown ? "52px" : "50%"}
        left={asDropdown ? "12px" : "50%"}
        w={asDropdown ? "440px" : "720px"}
        maxW="calc(100vw - 24px)"
        h={asDropdown ? "440px" : "480px"}
        maxH={asDropdown ? "calc(100vh - 72px)" : "calc(100vh - 24px)"}
        borderRadius="12px"
        display="flex"
        flexDirection="column"
        overflow="hidden"
        zIndex={201}
        onClick={(e: React.MouseEvent) => e.stopPropagation()}
        style={{
          transform: asDropdown
            ? mounted
              ? "none"
              : "scale(0.95) translateY(-8px)"
            : mounted
              ? "translate(-50%, -50%)"
              : "translate(-50%, -50%) scale(0.96)",
          transformOrigin: asDropdown ? "top left" : "center",
          opacity: mounted ? 1 : 0,
          transition: "transform 0.16s cubic-bezier(0.2,0.8,0.2,1), opacity 0.16s ease",
          background: C.bg,
          border: `1px solid ${C.line}`,
          boxShadow: asDropdown
            ? "0 18px 50px rgba(0,0,0,0.55)"
            : "0 32px 80px rgba(0,0,0,0.6)",
        }}
      >
        {/* Header */}
        <Flex
          align="center"
          justify="space-between"
          px="20px"
          flex="none"
          style={{ height: "48px", borderBottom: `1px solid ${C.line}` }}
        >
          <Text fontSize="14px" fontWeight="600" style={{ color: C.text }}>
            Settings
          </Text>
          <chakra.button
            type="button"
            onClick={onClose}
            display="flex"
            alignItems="center"
            justifyContent="center"
            w="26px"
            h="26px"
            borderRadius="5px"
            fontSize="12px"
            cursor="pointer"
            style={{ color: C.faint, transition: "color .12s" }}
            _hover={{ color: C.muted }}
          >
            ✕
          </chakra.button>
        </Flex>

        {/* Body */}
        <Flex flex="1" overflow="hidden">
          {/* Sidebar */}
          <Flex
            direction="column"
            flex="none"
            py="10px"
            gap="1px"
            w={{ base: "128px", md: "160px" }}
            style={{ background: C.panel, borderRight: `1px solid ${C.line}` }}
          >
            {CATEGORIES.map((cat) => {
              const active = category === cat.id;
              return (
                <chakra.button
                  key={cat.id}
                  type="button"
                  onClick={() => setCategory(cat.id)}
                  display="flex"
                  alignItems="center"
                  gap="9px"
                  px="12px"
                  py="9px"
                  mx="6px"
                  borderRadius="6px"
                  fontSize="13px"
                  fontWeight={active ? "500" : "400"}
                  cursor="pointer"
                  transition="all .12s"
                  textAlign="left"
                  style={{
                    color: active ? C.text : C.muted,
                    background: active ? C.raised : "transparent",
                  }}
                >
                  {cat.icon}
                  {cat.label}
                </chakra.button>
              );
            })}
          </Flex>

          {/* Content */}
          <Box flex="1" minW="0" overflowY="auto" p={asDropdown ? "18px" : "28px"} style={{ background: C.bg }}>

            {category === "accounts" && (
              <Box>
                <Text fontSize="13px" mb="20px" lineHeight="1.6" style={{ color: C.muted }}>
                  Connect your accounts to the streaming platforms you&apos;d like to sync with Prismarity.
                </Text>

                <PlatformSection
                  platform="twitch"
                  color={C.twitch}
                  displayName={auth.twitch?.displayName ?? null}
                  disconnecting={disconnecting}
                  onDisconnect={disconnect}
                  onConnect={() => openPopup("twitch")}
                />

                <Box my="12px" />

                <PlatformSection
                  platform="kick"
                  color={C.kick}
                  displayName={auth.kick?.displayName ?? null}
                  disconnecting={disconnecting}
                  onDisconnect={disconnect}
                  onConnect={() => openPopup("kick")}
                />

                <Box my="12px" />

                <PlatformSection
                  platform="youtube"
                  color={C.youtube}
                  displayName={auth.youtube?.displayName ?? null}
                  disconnecting={disconnecting}
                  onDisconnect={disconnect}
                  onConnect={() => openPopup("youtube")}
                />
              </Box>
            )}

            {category === "chat" && (
              <Box>
                {/* ── Beacon Mode ───────────────────────────── */}
                <Flex align="center" gap="12px" mb="10px">
                  <Box w="22px" flex="none" display="flex" justifyContent="center">
                    <BeaconSignal size={20} state={beaconMode && signalStatus !== "connected" ? "searching" : "strong"} />
                  </Box>
                  <Box flex="1">
                    <Text fontSize="14px" fontWeight="600" style={{ color: C.text }}>Beacon Mode</Text>
                    <Text fontSize="12px" style={{ color: C.faint, marginTop: 2 }}>
                      Auto-syncs to whatever stream you open in your browser via the Prismarity Beacon extension.
                    </Text>
                    {beaconMode && (
                      <Text fontSize="11px" fontWeight="500" style={{ color: "rgba(56,189,248,0.85)", marginTop: 5 }}>
                        {signalStatus === "connected"
                          ? "Signal strong — following your beacon"
                          : stalled
                          ? "No signal — is the Beacon extension installed?"
                          : "Waiting for signal…"}
                      </Text>
                    )}
                  </Box>
                  {/* Toggle pill */}
                  <chakra.button
                    type="button"
                    role="switch"
                    aria-checked={beaconMode}
                    onClick={() => setBeaconMode(!beaconMode)}
                    w="44px" h="24px" borderRadius="full" flex="none"
                    cursor="pointer"
                    transition="background .2s"
                    position="relative"
                    style={{ background: beaconMode ? "#38BDF8" : C.raised, border: `1px solid ${beaconMode ? "#38BDF8" : C.fieldLine}` }}
                  >
                    <Box
                      position="absolute"
                      top="3px"
                      w="18px" h="18px" borderRadius="full"
                      bg="white"
                      transition="left .2s"
                      style={{ left: beaconMode ? "23px" : "3px", boxShadow: "0 1px 3px rgba(0,0,0,0.4)" }}
                    />
                  </chakra.button>
                </Flex>

                <Box mb="18px" style={{ height: "1px", background: C.line }} />

                {/* Extension install hint */}
                <Box
                  borderRadius="8px" px="14px" py="12px"
                  style={{ background: C.raised, border: `1px solid ${C.line}` }}
                >
                  <Flex align="center" gap="8px" mb="6px">
                    <BeaconIcon size={14} color={C.muted} />
                    <Text fontSize="12px" fontWeight="600" style={{ color: C.muted }}>Prismarity Beacon Extension</Text>
                  </Flex>
                  <Text fontSize="11px" lineHeight="1.7" style={{ color: C.faint }}>
                    Install the companion extension from the <code style={{ color: C.muted }}>extension/</code> folder in the project.
                    It watches your active tab for Twitch and Kick streams and signals Prismarity automatically.
                  </Text>

                  {/* Pairing key — paste into the extension popup once so its
                      signals are bound to this account. */}
                  <Text fontSize="11px" fontWeight="600" mt="12px" mb="4px" style={{ color: C.muted }}>
                    Pairing key
                  </Text>
                  <Text fontSize="11px" lineHeight="1.6" mb="8px" style={{ color: C.faint }}>
                    Paste this into the extension popup to link it to your account. Keep it private.
                  </Text>
                  <Flex align="center" gap="8px">
                    <Box
                      flex="1" borderRadius="6px" px="10px" py="7px"
                      fontFamily="monospace" fontSize="11px"
                      overflow="hidden" textOverflow="ellipsis" whiteSpace="nowrap"
                      style={{ background: C.field, border: `1px solid ${C.fieldLine}`, color: C.muted }}
                      // Only expose the value on hover once explicitly revealed —
                      // never leak it via tooltip while masked (screen-share safe).
                      title={pairRevealed ? pairToken ?? undefined : undefined}
                    >
                      {!pairToken
                        ? "unavailable — sign in first"
                        : pairRevealed
                        ? pairToken
                        : "•".repeat(24)}
                    </Box>
                    <chakra.button
                      onClick={() => setPairRevealed((v) => !v)}
                      disabled={!pairToken}
                      borderRadius="6px" px="10px" py="7px"
                      fontSize="11px" fontWeight="600"
                      cursor={pairToken ? "pointer" : "not-allowed"}
                      aria-label={pairRevealed ? "Hide pairing key" : "Show pairing key"}
                      style={{
                        background: C.raised,
                        border: `1px solid ${C.fieldLine}`,
                        color: pairToken ? C.text : C.faint,
                      }}
                    >
                      {pairRevealed ? "Hide" : "Show"}
                    </chakra.button>
                    <chakra.button
                      onClick={copyPairToken}
                      disabled={!pairToken}
                      borderRadius="6px" px="12px" py="7px"
                      fontSize="11px" fontWeight="600"
                      cursor={pairToken ? "pointer" : "not-allowed"}
                      style={{
                        background: C.raised,
                        border: `1px solid ${C.fieldLine}`,
                        color: pairToken ? C.text : C.faint,
                      }}
                    >
                      {pairCopied ? "Copied" : "Copy"}
                    </chakra.button>
                  </Flex>
                  <chakra.button
                    onClick={rotatePairToken}
                    disabled={!pairToken || pairRotating}
                    mt="8px"
                    fontSize="10px" fontWeight="600"
                    cursor={pairToken && !pairRotating ? "pointer" : "not-allowed"}
                    style={{ background: "transparent", border: "none", color: C.faint, textDecoration: "underline" }}
                  >
                    {pairRotating ? "Regenerating…" : "Regenerate key"}
                  </chakra.button>
                </Box>
              </Box>
            )}

            {category === "about" && (
              <Box>
                <Text fontSize="18px" fontWeight="700" mb="6px" style={{ color: C.text }}>Prismarity</Text>
                <Text fontSize="13px" mb="20px" style={{ color: C.muted }}>
                  A multi-platform streaming dashboard for Twitch, Kick and YouTube.
                </Text>
                <Box mb="20px" style={{ height: "1px", background: C.line }} />
                <Text fontSize="12px" lineHeight="2" style={{ color: C.faint }}>
                  Authentication uses OAuth 2.0 with PKCE. Tokens are encrypted at rest using AES-256-GCM.
                  No credentials are ever sent to third-party servers.
                </Text>
                <Box my="20px" style={{ height: "1px", background: C.line }} />
                <Text fontSize="11px" fontWeight="700" mb="8px" style={{ color: C.muted, letterSpacing: "0.06em" }}>
                  PLATFORM NOTES
                </Text>
                <Text fontSize="12px" lineHeight="2" style={{ color: C.faint }}>
                  Twitch and Kick expose different data. Twitch provides your followed channels through
                  its official API; Kick&apos;s public API does not, so your Kick follows can&apos;t be
                  listed automatically — reach Kick channels through search instead. When a channel you
                  follow on Twitch also exists on Kick, both are linked so you see the unified view.
                </Text>
              </Box>
            )}
          </Box>
        </Flex>
      </Box>
    </>
  );
}
