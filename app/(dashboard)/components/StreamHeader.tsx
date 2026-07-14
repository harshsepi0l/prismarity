"use client";

import { Flex, Box, Text, chakra } from "@chakra-ui/react";
import { useChat } from "../_ctx/chat";
import { useStats, PLATFORM_LABEL } from "../_ctx/stats";
import { PlatformIcon, PLATFORM_COLOR } from "./PlatformIcon";

export function StreamHeader() {
  const { activeChannel, activeKickOnly } = useChat();
  const { platforms } = useStats();

  // Only the platforms toggled on via the lens are shown.
  const shown = platforms.filter((p) => p.included);
  const hasSelection = !!activeChannel || !!activeKickOnly;
  if (!hasSelection || shown.length === 0) return null;

  const live = shown.filter((p) => p.isLive);
  const isLive = live.length > 0;
  const name = activeChannel?.displayName ?? shown[0].channelName;
  // Best available profile picture — prefer live platform, else first shown.
  const avatar = (isLive ? live : shown).find((p) => p.profileImageUrl)?.profileImageUrl ?? null;

  const descRows = (isLive ? live : shown).filter((p) => p.title || p.category);

  return (
    <Flex
      flex="none"
      align="flex-start"
      gap="13px"
      px="24px"
      py="13px"
      borderBottomWidth="1px"
      borderColor="line"
    >
      {/* Profile avatar */}
      {avatar ? (
        <chakra.img
          src={avatar}
          alt={name}
          flex="none"
          w="40px"
          h="40px"
          borderRadius="full"
          objectFit="cover"
        />
      ) : (
        <Flex
          flex="none"
          w="40px"
          h="40px"
          borderRadius="full"
          bg="raised"
          align="center"
          justify="center"
          fontSize="16px"
          fontWeight="700"
          color="muted"
        >
          {name[0]?.toUpperCase()}
        </Flex>
      )}

      <Box minW="0" flex="1">
        <Flex align="center" gap="9px" mb="3px">
          <Text fontWeight="600" fontSize="16px" color="text" truncate flex="none">
            {name}
          </Text>

          {isLive ? (
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
            <Text fontFamily="mono" fontSize="11px" color="faint" flex="none">
              OFFLINE
            </Text>
          )}

          {/* Platform logos — the platforms this streamer is live on. */}
          {isLive && (
            <Flex align="center" gap="6px" flex="none">
              {live.map((p) => (
                <PlatformIcon key={p.platform} platform={p.platform} size={15} />
              ))}
            </Flex>
          )}
        </Flex>

        {/* Descriptions — each live platform's own title + category. */}
        {descRows.length > 0 ? (
          <Flex direction="column" gap="2px">
            {descRows.map((p) => (
              <Flex key={p.platform} align="baseline" gap="7px" minW="0">
                {descRows.length > 1 && (
                  <Text
                    fontFamily="mono"
                    fontSize="9px"
                    fontWeight="600"
                    letterSpacing="0.06em"
                    color={PLATFORM_COLOR[p.platform]}
                    flex="none"
                    title={PLATFORM_LABEL[p.platform]}
                  >
                    {p.platform.toUpperCase()}
                  </Text>
                )}
                <Text
                  fontSize="12.5px"
                  color="muted"
                  lineHeight="1.4"
                  minW="0"
                  style={{ overflowWrap: "anywhere" }}
                >
                  {p.title || "—"}
                  {p.category ? ` · ${p.category}` : ""}
                </Text>
              </Flex>
            ))}
          </Flex>
        ) : (
          <Text fontSize="12.5px" color="faint">
            {isLive ? "No title" : "Offline"}
          </Text>
        )}
      </Box>
    </Flex>
  );
}
