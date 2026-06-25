"use client";

import { Flex, Box, Text } from "@chakra-ui/react";
import { Logo } from "./Logo";
import FilterChips from "./FilterChips";
import ModeToggle from "./ModeToggle";
import { useSession } from "../useSession";

export function TopBar() {
  const { mode, setMode, activeFilters, toggleFilter } = useSession();

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
            bg="#FF5C5C"
            animation="pris-pulse 1.4s ease-in-out infinite"
          />
          <Text
            fontFamily="mono"
            fontSize="11px"
            fontWeight="600"
            letterSpacing="0.14em"
            color="#FF5C5C"
          >
            LIVE
          </Text>
        </Flex>
        <Flex align="baseline" gap="7px">
          <Text fontFamily="mono" fontSize="17px" fontWeight="600" color="text">
            12,480
          </Text>
          <Text fontSize="12px" color="muted">
            viewers
          </Text>
        </Flex>
      </Flex>
    </Flex>
  );
}
