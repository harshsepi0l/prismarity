"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Box, Flex, Text, chakra } from "@chakra-ui/react";
import { PlatformIcon } from "./PlatformIcon";

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
};

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

type Category = "accounts" | "chat" | "about";

interface Props {
  auth: { twitch: { displayName: string } | null; kick: { displayName: string } | null };
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
  platform: "twitch" | "kick";
  color: string;
  displayName: string | null;
  disconnecting: "twitch" | "kick" | null;
  onDisconnect: (p: "twitch" | "kick") => void;
  onConnect: () => void;
}) {
  const label = platform === "twitch" ? "Twitch" : "Kick";

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
  const [disconnecting, setDisconnecting] = useState<"twitch" | "kick" | null>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const openPopup = useCallback((platform: "twitch" | "kick") => {
    const popup = window.open(
      `/api/auth/${platform}/login?popup=1`,
      "prismarity_auth",
      "width=520,height=680,menubar=no,toolbar=no,location=no,status=no"
    );
    if (!popup) return;
    const handler = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return;
      if (e.data?.type === "prismarity_auth_success" || e.data?.type === "prismarity_auth_error") {
        window.removeEventListener("message", handler);
        router.refresh();
      }
    };
    window.addEventListener("message", handler);
  }, [router]);

  const disconnect = useCallback(async (platform: "twitch" | "kick") => {
    setDisconnecting(platform);
    try {
      await fetch("/api/auth/disconnect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform }),
      });
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
        style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(3px)" }}
      />

      <Box
        position="fixed"
        top="50%"
        left="50%"
        w="720px"
        maxW="calc(100vw - 32px)"
        h="480px"
        borderRadius="12px"
        display="flex"
        flexDirection="column"
        overflow="hidden"
        zIndex={201}
        onClick={(e: React.MouseEvent) => e.stopPropagation()}
        style={{
          transform: "translate(-50%, -50%)",
          background: C.bg,
          border: `1px solid ${C.line}`,
          boxShadow: "0 32px 80px rgba(0,0,0,0.6)",
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
            style={{ width: "160px", background: C.panel, borderRight: `1px solid ${C.line}` }}
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
          <Box flex="1" overflowY="auto" p="28px" style={{ background: C.bg }}>

            {category === "accounts" && (
              <Box>
                <Text fontSize="13px" mb="20px" lineHeight="1.6" style={{ color: C.muted }}>
                  Connect your accounts to the streaming platforms you'd like to sync with Prismarity.
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
              </Box>
            )}

            {category === "chat" && (
              <Flex direction="column" align="center" justify="center" h="full" gap="6px">
                <Text fontSize="13px" style={{ color: C.muted }}>Chat display settings</Text>
                <Text fontSize="12px" style={{ color: C.faint }}>Coming soon</Text>
              </Flex>
            )}

            {category === "about" && (
              <Box>
                <Text fontSize="18px" fontWeight="700" mb="6px" style={{ color: C.text }}>Prismarity</Text>
                <Text fontSize="13px" mb="20px" style={{ color: C.muted }}>
                  A multi-platform streaming dashboard for Twitch and Kick.
                </Text>
                <Box mb="20px" style={{ height: "1px", background: C.line }} />
                <Text fontSize="12px" lineHeight="2" style={{ color: C.faint }}>
                  Authentication uses OAuth 2.0 with PKCE. Tokens are encrypted at rest using AES-256-GCM.
                  No credentials are ever sent to third-party servers.
                </Text>
              </Box>
            )}
          </Box>
        </Flex>
      </Box>
    </>
  );
}
