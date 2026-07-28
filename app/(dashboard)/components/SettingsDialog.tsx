"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Box, Flex, Text, chakra } from "@chakra-ui/react";
import { PlatformIcon } from "./PlatformIcon";
import { BeaconSignal } from "./BeaconSignal";
import { clearSessionScopedStorage } from "@/lib/clientStorage";
import { useChat, useChatSignal } from "../_ctx/chat";
import { useChatPrefs } from "../_ctx/chatPrefs";
import { useLayout } from "../_ctx/layout";
import { useColorMode, type ColorMode } from "../../_ctx/color-mode";
import { c, alpha as withAlpha } from "../../theme-colors";

// All surface/text colors come from the centralized theme (theme-colors.ts) so
// this panel re-washes with the rest of the app and flips on light/dark. `C`
// stays as the local alias the JSX already reads (C.field, C.muted, …).
const C = c;

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

// Half-filled contrast disc — the light/dark appearance section.
const THEME_ICON = (
  <svg width="13" height="13" viewBox="0 0 24 24" aria-hidden>
    <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2" />
    <path d="M12 3a9 9 0 000 18V3z" fill="currentColor" />
  </svg>
);

// The three color-mode choices for the Appearance segmented control.
const SUN_ICON = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </svg>
);
const MOON_ICON = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <path d="M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z" />
  </svg>
);
const SYSTEM_ICON = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden>
    <rect x="3" y="4" width="18" height="12" rx="1.5" />
    <path d="M8 20h8M12 16v4" strokeLinecap="round" />
  </svg>
);

const THEME_OPTIONS: { id: ColorMode; label: string; icon: React.ReactNode }[] = [
  { id: "light", label: "Light", icon: SUN_ICON },
  { id: "dark", label: "Dark", icon: MOON_ICON },
  { id: "system", label: "Auto", icon: SYSTEM_ICON },
];

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

type Category = "accounts" | "chat" | "appearance" | "about";

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
          <Text fontSize="12px" flex="1" minW="0" truncate style={{ color: C.text }}>
            Connected as{" "}
            <Text as="span" fontWeight="600">{displayName}</Text>
          </Text>
          <chakra.button
            type="button"
            onClick={() => onDisconnect(platform)}
            disabled={disconnecting !== null}
            flex="none"
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
          style={{ background: color, color: C.accentText }}
        >
          <PlatformIcon platform={platform} color={C.accentText} size={14} />
          Connect with {label}
        </chakra.button>
      )}
    </Box>
  );
}

// On/off pill toggle in the app's amber accent — mirrors the Beacon Mode switch.
function ToggleSwitch({ on, onToggle, label }: { on: boolean; onToggle: () => void; label: string }) {
  return (
    <chakra.button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={onToggle}
      w="44px"
      h="24px"
      borderRadius="full"
      flex="none"
      cursor="pointer"
      transition="background .2s"
      position="relative"
      style={{ background: on ? C.accent : C.raised, border: `1px solid ${on ? C.accent : C.fieldLine}` }}
    >
      <Box
        position="absolute"
        top="3px"
        w="18px"
        h="18px"
        borderRadius="full"
        bg="white"
        transition="left .2s"
        style={{ left: on ? "23px" : "3px", boxShadow: "0 1px 3px rgba(0,0,0,0.4)" }}
      />
    </chakra.button>
  );
}

// Label + description on the left, a control (e.g. ToggleSwitch) on the right.
function SettingRow({
  title,
  description,
  control,
}: {
  title: string;
  description: string;
  control: React.ReactNode;
}) {
  return (
    <Flex align="center" gap="12px" py="10px">
      <Box flex="1">
        <Text fontSize="14px" fontWeight="600" style={{ color: C.text }}>
          {title}
        </Text>
        <Text fontSize="12px" style={{ color: C.faint, marginTop: 2 }}>
          {description}
        </Text>
      </Box>
      {control}
    </Flex>
  );
}

// Chip list + input for editing a keyword set. Enter or comma commits the draft;
// each chip has an ✕ to remove it. Case-insensitive de-dupe on add.
function KeywordEditor({
  keywords,
  onChange,
  placeholder,
}: {
  keywords: string[];
  onChange: (next: string[]) => void;
  placeholder: string;
}) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const v = draft.trim();
    if (!v) return;
    if (!keywords.some((k) => k.toLowerCase() === v.toLowerCase())) onChange([...keywords, v]);
    setDraft("");
  };
  return (
    <Box mt="8px">
      {keywords.length > 0 && (
        <Flex wrap="wrap" gap="6px" mb="8px">
          {keywords.map((kw) => (
            <Flex
              key={kw}
              align="center"
              gap="6px"
              px="8px"
              py="3px"
              borderRadius="full"
              style={{ background: C.field, border: `1px solid ${C.fieldLine}` }}
            >
              <Text fontSize="11px" style={{ color: C.muted }}>
                {kw}
              </Text>
              <chakra.button
                type="button"
                onClick={() => onChange(keywords.filter((k) => k !== kw))}
                aria-label={`Remove ${kw}`}
                fontSize="10px"
                cursor="pointer"
                style={{ color: C.faint }}
                _hover={{ color: C.text }}
              >
                ✕
              </chakra.button>
            </Flex>
          ))}
        </Flex>
      )}
      <chakra.input
        value={draft}
        onChange={(e) => setDraft(e.currentTarget.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            add();
          }
        }}
        onBlur={add}
        placeholder={placeholder}
        w="100%"
        borderRadius="6px"
        px="10px"
        py="7px"
        fontSize="12px"
        style={{ background: C.field, border: `1px solid ${C.fieldLine}`, color: C.text }}
      />
    </Box>
  );
}

export function SettingsDialog({ auth, onClose }: Props) {
  const router = useRouter();
  const [category, setCategory] = useState<Category>("accounts");
  const [disconnecting, setDisconnecting] = useState<ConnectPlatform | null>(null);
  const { beaconMode, setBeaconMode } = useChat();
  const signalStatus = useChatSignal();
  const chatPrefs = useChatPrefs();
  const { isCompact } = useLayout();
  const { mode, resolved, setMode, mounted: themeMounted } = useColorMode();
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
    { id: "appearance", label: "Appearance", icon: THEME_ICON },
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

            {/* Brand — pinned to the bottom-left of the panel. */}
            <Text
              mt="auto" px="18px" pt="12px"
              fontFamily="mono"
              fontSize="11px"
              fontWeight="700"
              letterSpacing="0.18em"
              style={{ color: C.faint }}
            >
              PRISMARITY
            </Text>
          </Flex>

          {/* Content */}
          <Box flex="1" minW="0" overflowY="auto" p={asDropdown ? "18px" : { base: "16px", md: "28px" }} style={{ background: C.bg }}>

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
                {/* ── Chat display ──────────────────────────── */}
                <Text
                  fontSize="11px"
                  fontWeight="700"
                  letterSpacing="0.08em"
                  mb="4px"
                  style={{ color: C.faint, textTransform: "uppercase" }}
                >
                  Chat display
                </Text>

                <SettingRow
                  title="Readable username colors"
                  description="Brighten hard-to-read names so dark colors stay legible on the chat rows."
                  control={
                    <ToggleSwitch
                      on={chatPrefs.readableColors}
                      onToggle={() => chatPrefs.setReadableColors(!chatPrefs.readableColors)}
                      label="Toggle readable username colors"
                    />
                  }
                />

                <SettingRow
                  title="Show timestamps"
                  description="Show the time each message was sent."
                  control={
                    <ToggleSwitch
                      on={chatPrefs.timestamps}
                      onToggle={() => chatPrefs.setTimestamps(!chatPrefs.timestamps)}
                      label="Toggle timestamps"
                    />
                  }
                />

                <SettingRow
                  title="Pause on hover"
                  description="Hold auto-scroll while your cursor is over the chat. Resumes 5 seconds after the cursor goes still, or the moment it leaves. Scrolling up always pauses until you jump back."
                  control={
                    <ToggleSwitch
                      on={chatPrefs.pauseOnHover}
                      onToggle={() => chatPrefs.setPauseOnHover(!chatPrefs.pauseOnHover)}
                      label="Toggle pause on hover"
                    />
                  }
                />

                <Box py="10px">
                  <Text fontSize="14px" fontWeight="600" style={{ color: C.text }}>
                    Highlight keywords
                  </Text>
                  <Text fontSize="12px" style={{ color: C.faint, marginTop: 2 }}>
                    Messages containing any of these get an amber highlight. Press Enter to add.
                  </Text>
                  <KeywordEditor
                    keywords={chatPrefs.highlightKeywords}
                    onChange={chatPrefs.setHighlightKeywords}
                    placeholder="Add a keyword…"
                  />
                </Box>

                <Box py="10px">
                  <Text fontSize="14px" fontWeight="600" style={{ color: C.text }}>
                    Hidden keywords
                  </Text>
                  <Text fontSize="12px" style={{ color: C.faint, marginTop: 2 }}>
                    Messages containing any of these are hidden from your feed. Press Enter to add.
                  </Text>
                  <KeywordEditor
                    keywords={chatPrefs.blacklistKeywords}
                    onChange={chatPrefs.setBlacklistKeywords}
                    placeholder="Add a keyword…"
                  />
                </Box>

                <Box mb="18px" mt="8px" style={{ height: "1px", background: C.line }} />

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
                    Install the extension from your browser&apos;s web store.
                  </Text>

                  {/* Pairing key — paste into the extension popup once so its
                      signals are bound to this account. */}
                  <Text fontSize="11px" fontWeight="600" mt="12px" mb="4px" style={{ color: C.muted }}>
                    Pairing key
                  </Text>
                  <Text fontSize="11px" lineHeight="1.6" mb="8px" style={{ color: C.faint }}>
                    Paste this into the extension popup to link it to your account. Keep it private.
                  </Text>
                  <Flex align="center" gap="8px" flexWrap="wrap">
                    <Box
                      flex="1 1 140px" minW="120px" borderRadius="6px" px="10px" py="7px"
                      fontFamily="mono" fontSize="11px"
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

            {category === "appearance" && (
              <Box>
                <Text fontSize="13px" mb="20px" lineHeight="1.6" style={{ color: C.muted }}>
                  Choose how Prismarity looks. Pick a fixed theme, or match your
                  browser&rsquo;s appearance and switch automatically with it.
                </Text>

                <Text fontSize="11px" fontWeight="700" letterSpacing="0.14em" mb="10px" style={{ color: C.faint }}>
                  THEME
                </Text>

                <Flex gap="8px" flexWrap="wrap">
                  {THEME_OPTIONS.map((opt) => {
                    // Until mounted we don't know the stored choice; render neutral
                    // to avoid a hydration flash of the wrong active pill.
                    const active = themeMounted && mode === opt.id;
                    return (
                      <chakra.button
                        key={opt.id}
                        type="button"
                        onClick={() => setMode(opt.id)}
                        aria-pressed={active}
                        flex="1 1 100px"
                        display="flex"
                        flexDirection="column"
                        alignItems="center"
                        gap="7px"
                        px="12px"
                        py="14px"
                        borderRadius="10px"
                        borderWidth="1.5px"
                        cursor="pointer"
                        transition="all .12s"
                        style={{
                          color: active ? C.accent : C.muted,
                          borderColor: active ? C.accent : C.fieldLine,
                          background: active ? withAlpha(C.accent, 0.1) : C.field,
                        }}
                      >
                        {opt.icon}
                        <Text fontSize="12px" fontWeight="600" style={{ color: active ? C.text : C.muted }}>
                          {opt.label}
                        </Text>
                      </chakra.button>
                    );
                  })}
                </Flex>

                <Text fontSize="12px" mt="12px" lineHeight="1.6" style={{ color: C.faint }}>
                  {themeMounted && mode === "system"
                    ? `Matching your browser’s appearance — currently ${resolved}.`
                    : `Using the ${themeMounted ? mode : "dark"} theme.`}
                </Text>
              </Box>
            )}

            {category === "about" && (
              <Box>
                <Text fontSize="18px" fontWeight="700" mb="6px" style={{ color: C.text }}>Prismarity</Text>
                <Text fontSize="13px" mb="20px" lineHeight="1.7" style={{ color: C.muted }}>
                  One place to watch and chat across Twitch, Kick and YouTube. Connect your
                  accounts, follow your channels, and jump between streams without juggling tabs.
                </Text>
                <Box mb="20px" style={{ height: "1px", background: C.line }} />
                <Text fontSize="12px" lineHeight="1.8" style={{ color: C.faint }}>
                  Your accounts stay secure — sign-in happens through each platform&apos;s official
                  login and your details are never shared with anyone else.
                </Text>
              </Box>
            )}
          </Box>
        </Flex>
      </Box>
    </>
  );
}
