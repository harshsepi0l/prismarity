"use client";

import { useState } from "react";
import { Flex, Box, Text, chakra } from "@chakra-ui/react";
import { useChat } from "../useChat";
import { useStats, formatUptime, type PlatformLive } from "../useStats";
import { PlatformIcon, PLATFORM_COLOR } from "./PlatformIcon";
import type { Platform } from "../chat/types";

function HeaderStat({ label, value }: { label: string; value: string }) {
  return (
    <Box textAlign="right" flex="none">
      <Text fontFamily="mono" fontSize="15px" fontWeight="600" color="text">
        {value}
      </Text>
      <Text fontSize="10px" color="muted">
        {label}
      </Text>
    </Box>
  );
}

export function StreamHeader() {
  const { activeChannel, activeKickOnly } = useChat();
  const { platforms } = useStats();
  // Which platform's context the header is reading, when more than one is shown.
  const [primaryChoice, setPrimaryChoice] = useState<Platform | null>(null);

  // Only the platforms toggled on via the lens are shown here.
  const shown = platforms.filter((p) => p.included);
  const hasSelection = !!activeChannel || !!activeKickOnly;
  if (!hasSelection || shown.length === 0) return null;

  const primary: PlatformLive =
    shown.find((p) => p.platform === primaryChoice) ?? shown[0];
  const color = PLATFORM_COLOR[primary.platform];

  return (
    <Flex
      flex="none"
      align="center"
      gap="14px"
      px="24px"
      py="12px"
      borderBottomWidth="1px"
      borderColor="line"
    >
      {/* Platform switch — pick which platform's stream context you're reading.
          A single shown platform renders as just its logo. */}
      {shown.length > 1 ? (
        <Flex
          align="center"
          gap="2px"
          flex="none"
          bg="raised"
          borderRadius="8px"
          p="3px"
        >
          {shown.map((p) => {
            const on = p.platform === primary.platform;
            return (
              <chakra.button
                key={p.platform}
                type="button"
                onClick={() => setPrimaryChoice(p.platform)}
                title={`Show ${p.platform} context`}
                aria-pressed={on}
                display="inline-flex"
                alignItems="center"
                p="5px"
                borderRadius="6px"
                bg={on ? "bg" : "transparent"}
                opacity={on ? 1 : 0.45}
                cursor="pointer"
                transition="opacity .12s, background .12s"
                _hover={{ opacity: 1 }}
              >
                <PlatformIcon platform={p.platform} size={15} />
              </chakra.button>
            );
          })}
        </Flex>
      ) : (
        <PlatformIcon platform={primary.platform} size={18} />
      )}

      <Box minW="0" flex="1">
        <Flex align="center" gap="8px">
          <Text fontWeight="600" fontSize="15px" color="text" truncate>
            {primary.channelName}
          </Text>
          {primary.isLive ? (
            <Flex align="center" gap="5px" flex="none">
              <Box
                w="7px"
                h="7px"
                borderRadius="full"
                bg="#FF5C5C"
                animation="pris-pulse 1.4s ease-in-out infinite"
              />
              <Text fontFamily="mono" fontSize="11px" fontWeight="600" color="#FF5C5C">
                LIVE
              </Text>
            </Flex>
          ) : (
            <Text fontFamily="mono" fontSize="11px" color="faint">
              OFFLINE
            </Text>
          )}
          {/* When both platforms are shown, label which one this context is. */}
          {shown.length > 1 && (
            <Text fontFamily="mono" fontSize="10px" color={color} letterSpacing="0.06em">
              {primary.platform.toUpperCase()}
            </Text>
          )}
        </Flex>
        <Text fontSize="12px" color="muted" truncate mt="1px">
          {primary.title || "—"}
          {primary.category ? ` · ${primary.category}` : ""}
        </Text>
      </Box>

      {primary.isLive && (
        <Flex align="center" gap="18px" flex="none">
          <HeaderStat label="viewers" value={primary.viewers.toLocaleString()} />
          <HeaderStat label="uptime" value={formatUptime(primary.uptimeMs)} />
        </Flex>
      )}
    </Flex>
  );
}
