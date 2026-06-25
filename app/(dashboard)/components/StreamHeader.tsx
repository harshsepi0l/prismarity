"use client";

import { Flex, Box, Text } from "@chakra-ui/react";
import { useChat } from "../useChat";
import { useStats, formatUptime } from "../useStats";
import { PlatformIcon } from "./PlatformIcon";

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
  const { activeChannel } = useChat();
  const stats = useStats();

  if (!activeChannel) return null;

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
      <PlatformIcon platform="twitch" size={18} />
      <Box minW="0" flex="1">
        <Flex align="center" gap="8px">
          <Text fontWeight="600" fontSize="15px" color="text" truncate>
            {activeChannel.displayName}
          </Text>
          {stats.isLive ? (
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
        </Flex>
        <Text fontSize="12px" color="muted" truncate mt="1px">
          {stats.title || "—"}
          {stats.category ? ` · ${stats.category}` : ""}
        </Text>
      </Box>
      {stats.isLive && (
        <Flex align="center" gap="18px" flex="none">
          <HeaderStat label="viewers" value={stats.viewers.toLocaleString()} />
          <HeaderStat label="uptime" value={formatUptime(stats.uptimeMs)} />
        </Flex>
      )}
    </Flex>
  );
}
