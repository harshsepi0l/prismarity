"use client";

import { Flex, Box, Text, chakra } from "@chakra-ui/react";
import { PlatformIcon, PLATFORM_COLOR } from "../../components/PlatformIcon";
import type { Platform } from "../../types";

// Shown in the chat area when no platform is connected — the "log in to get
// started" gate. Each row is a full-page OAuth login link.
function ConnectRow({
  platform,
  label,
  href,
  comingSoon,
}: {
  platform: Platform;
  label: string;
  href?: string;
  comingSoon?: boolean;
}) {
  const color = PLATFORM_COLOR[platform];
  const row = (
    <Flex
      align="center" gap="12px" w="100%" px="16px" h="48px"
      borderRadius="10px" borderWidth="1px" borderColor="line" bg="raised"
      opacity={comingSoon ? 0.5 : 1}
      cursor={comingSoon ? "default" : "pointer"}
      transition="border-color .12s, background .12s"
      _hover={comingSoon ? undefined : { borderColor: color, bg: "panel" }}
    >
      <Box w="3px" h="22px" borderRadius="full" flex="none" style={{ background: color }} />
      <PlatformIcon platform={platform} size={16} />
      <Text flex="1" textAlign="left" fontSize="14px" fontWeight="500" color="text">
        {label}
      </Text>
      {comingSoon && (
        <Text fontSize="11px" fontFamily="mono" color="faint" flex="none">
          Coming soon
        </Text>
      )}
    </Flex>
  );

  if (comingSoon || !href) return row;
  return (
    <chakra.a href={href} display="block" w="100%">
      {row}
    </chakra.a>
  );
}

export default function ChatEmptyState() {
  return (
    <Flex flex="1" minW="0" align="center" justify="center" p="24px">
      <Box maxW="380px" w="100%">
        <Text fontFamily="heading" fontSize="22px" fontWeight="600" color="text" mb="6px" textAlign="center">
          Welcome to Prismarity
        </Text>
        <Text fontSize="14px" color="muted" mb="24px" lineHeight="1.6" textAlign="center">
          Connect a platform to get started.
        </Text>
        <Flex direction="column" gap="10px">
          <ConnectRow platform="twitch" label="Continue with Twitch" href="/api/auth/twitch/login" />
          <ConnectRow platform="kick" label="Continue with Kick" href="/api/auth/kick/login" />
          <ConnectRow platform="youtube" label="Continue with YouTube" href="/api/auth/youtube/login" />
        </Flex>
        <Text fontSize="12px" color="faint" mt="18px" lineHeight="1.6" textAlign="center">
          Already connected? Add or manage other connections anytime from the prism menu in the
          top-left.
        </Text>
      </Box>
    </Flex>
  );
}
