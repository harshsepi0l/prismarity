"use client";

import { Flex, Box, Text } from "@chakra-ui/react";
import { Logo } from "./Logo";
import FilterChips from "./FilterChips";
import ModeToggle from "./ModeToggle";
import { useSession } from "../useSession";
import { useChat } from "../useChat";

export function TopBar() {
  const { mode, setMode, activeFilters, toggleFilter } = useSession();
  const { status, activeChannel } = useChat();

  // The indicator reflects whether the WATCHED channel is live. Chat IRC can be
  // connected to an offline channel, so "connected" alone is not "live".
  const s =
    status === "connecting"
      ? { color: "#F5A623", label: "CONNECTING", pulse: false }
      : status === "error"
        ? { color: "#FF5C5C", label: "ERROR", pulse: false }
        : status === "connected" && activeChannel?.isLive
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
      <Flex align="center" gap="12px">
        <Logo />
        <Text
          fontFamily="heading"
          fontWeight="700"
          fontSize="17px"
          letterSpacing="0.16em"
          color="text"
        >
          PRISMARITY
        </Text>
      </Flex>

      <FilterChips active={activeFilters} onChange={toggleFilter} />

      <Flex ml="auto" align="center" gap="20px">
        <ModeToggle mode={mode} onChange={setMode} />
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
