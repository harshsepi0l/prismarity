"use client";

import { Box, Flex, Text, chakra } from "@chakra-ui/react";
import { PlatformIcon, PLATFORM_LABEL } from "../../../components/PlatformIcon";
import type { Platform } from "../../../types";

const SEND_PLATFORMS: { id: Platform; color: string }[] = [
  { id: "twitch", color: "#A66CFF" },
  { id: "kick", color: "#5BE37D" },
  { id: "youtube", color: "#FF4E45" },
];

interface SendTargetsProps {
  available: Platform[];
  sendTargets: Set<Platform>;
  toggleSendTarget: (platform: Platform) => void;
  liveByPlatform: Partial<Record<Platform, boolean>>;
}

// The "SEND TO" chips — one per available platform. Tapping a chip arms/disarms
// delivery of your message to that platform (the glow); an amber dot warns when
// an armed platform's channel is currently offline.
export default function SendTargets({
  available,
  sendTargets,
  toggleSendTarget,
  liveByPlatform,
}: SendTargetsProps) {
  return (
    <Flex align="center" gap="8px">
      <Text fontFamily="mono" fontSize="10px" letterSpacing="0.06em" color="faint" flex="none">
        SEND TO
      </Text>
      {SEND_PLATFORMS.filter(({ id }) => available.includes(id)).map(({ id, color }) => {
        const armed = sendTargets.has(id);
        const offline = liveByPlatform[id] === false;
        const label = PLATFORM_LABEL[id];
        const title = !armed
          ? `Click to send your messages to ${label}`
          : offline
            ? `${label} is offline — your message posts to its offline chat`
            : `Sending to ${label} — click to stop`;
        return (
          <chakra.button
            key={id}
            type="button"
            onClick={() => toggleSendTarget(id)}
            title={title}
            aria-pressed={armed}
            position="relative"
            display="inline-flex"
            alignItems="center"
            gap="6px"
            flex="none"
            px="9px"
            py="4px"
            borderRadius="full"
            borderWidth="1px"
            borderColor={armed ? `${color}66` : "fieldLine"}
            bg={armed ? `${color}1A` : "transparent"}
            color={armed ? "text" : "faint"}
            opacity={armed ? 1 : 0.7}
            cursor="pointer"
            transition="background .12s, border-color .12s, opacity .12s, filter .12s"
            style={{ filter: armed && !offline ? `drop-shadow(0 0 4px ${color}55)` : "none" }}
            _hover={{ opacity: 1, borderColor: `${color}66` }}
          >
            <PlatformIcon platform={id} color={color} size={14} />
            <Text fontSize="11px" fontWeight="600">
              {label}
            </Text>
            {armed && offline && (
              <Box
                position="absolute"
                top="-3px"
                right="-3px"
                w="7px"
                h="7px"
                borderRadius="full"
                bg="#F5A623"
                borderWidth="1.5px"
                borderColor="bg"
                pointerEvents="none"
                style={{ animation: "pris-pulse 1.2s ease-in-out infinite" }}
              />
            )}
          </chakra.button>
        );
      })}
      {available.length === 0 && (
        <Text fontSize="11px" color="faint" opacity={0.7}>
          Select a channel
        </Text>
      )}
    </Flex>
  );
}
