"use client";

import { Flex, Box, Text } from "@chakra-ui/react";
import { Logo } from "./Logo";
import FilterChips from "./FilterChips";
import ModeToggle from "./ModeToggle";
import { StreamerSearch } from "./StreamerSearch";
import { useSession, allowedModes, clampMode } from "../useSession";
import { useChat } from "../useChat";
import { useStats } from "../useStats";

export function TopBar() {
  const { mode, setMode, activeFilters, toggleFilter, connectedPlatforms } = useSession();
  const { status, activeChannel, activeKickOnly, activeRole } = useChat();
  const { anyLive } = useStats();

  // Your role for the active selection (Twitch or Kick) decides offered modes.
  const role = activeRole;
  const modes = allowedModes(role);
  const effectiveMode = clampMode(mode, role);

  // The indicator reflects the ACTIVE SELECTION across platforms: live (red) when
  // any shown platform is live, else offline. The Twitch socket's connecting /
  // error states show transiently while reading a Twitch channel.
  const hasSelection = !!activeChannel || !!activeKickOnly;
  const s = !hasSelection
    ? { color: "#5C6479", label: "OFFLINE", pulse: false }
    : activeChannel && status === "connecting"
      ? { color: "#F5A623", label: "CONNECTING", pulse: false }
      : activeChannel && status === "error"
        ? { color: "#FF5C5C", label: "ERROR", pulse: false }
        : anyLive
          ? { color: "#FF5C5C", label: "LIVE", pulse: true }
          : { color: "#5C6479", label: "OFFLINE", pulse: false };

  return (
    <Flex
      as="header"
      flex="none"
      h="60px"
      align="center"
      gap="20px"
      px="24px"
      borderBottomWidth="1px"
      borderColor="line"
    >
      <Flex align="center" gap="10px" flex="none">
        <Logo />
        <Text
          fontFamily="heading"
          fontWeight="700"
          fontSize="17px"
          letterSpacing="0.16em"
          color="text"
          display={{ base: "none", md: "block" }}
        >
          PRISMARITY
        </Text>
      </Flex>

      <StreamerSearch />

      <FilterChips active={activeFilters} connected={connectedPlatforms} onChange={toggleFilter} />

      <Flex align="center" gap="20px" flex="none">
        <ModeToggle mode={effectiveMode} modes={modes} onChange={setMode} />
        <Flex align="center" gap="8px">
          <Box
            w="8px"
            h="8px"
            borderRadius="full"
            bg={s.color}
            animation={s.pulse ? "pris-pulse 1.4s ease-in-out infinite" : undefined}
          />
          <Text
            fontFamily="mono"
            fontSize="11px"
            fontWeight="600"
            letterSpacing="0.14em"
            color={s.color}
          >
            {s.label}
          </Text>
        </Flex>
      </Flex>
    </Flex>
  );
}
