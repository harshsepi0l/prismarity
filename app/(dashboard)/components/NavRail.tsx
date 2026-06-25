"use client";

import NextLink from "next/link";
import { usePathname } from "next/navigation";
import { Flex, Box, Text, chakra } from "@chakra-ui/react";
import { useLayout } from "../useLayout";
import { ResizeHandle } from "./ResizeHandle";
import { PlatformIcon } from "./PlatformIcon";
import type { Platform } from "../chat/types";

const CHAT_ICON = (
  <Box
    w="17px"
    h="13px"
    flex="none"
    borderWidth="1.8px"
    borderStyle="solid"
    borderColor="currentColor"
    borderRadius="4px 4px 4px 1px"
  />
);

const LOYALTY_ICON = (
  <Box
    w="13px"
    h="13px"
    flex="none"
    borderWidth="1.8px"
    borderStyle="solid"
    borderColor="currentColor"
    transform="rotate(45deg)"
  />
);

const VODS_ICON = (
  <Box
    w="0"
    h="0"
    flex="none"
    ml="3px"
    borderLeft="10px solid currentColor"
    borderTop="6px solid transparent"
    borderBottom="6px solid transparent"
  />
);

const NAV = [
  { href: "/chat", label: "Chat", icon: CHAT_ICON },
  { href: "/loyalty", label: "Loyalty", icon: LOYALTY_ICON },
  { href: "/vods", label: "VODs", icon: VODS_ICON },
];

const CONNECTED: { name: string; platform: Platform; color: string }[] = [
  { name: "Twitch", platform: "twitch", color: "#A66CFF" },
  { name: "YouTube", platform: "youtube", color: "#FF5C5C" },
  { name: "Kick", platform: "kick", color: "#5BE37D" },
];

// Below this width the rail drops labels and shows icons only.
const COLLAPSE_AT = 168;

export function NavRail() {
  const pathname = usePathname();
  const { navWidth, setNavWidth } = useLayout();
  const collapsed = navWidth < COLLAPSE_AT;

  return (
    <Flex
      as="nav"
      position="relative"
      flex="none"
      w={`${navWidth}px`}
      direction="column"
      borderRightWidth="1px"
      borderColor="line"
      px={collapsed ? "10px" : "14px"}
      py="22px"
      overflow="hidden"
    >
      {!collapsed && (
        <Text
          fontFamily="mono"
          fontSize="10px"
          letterSpacing="0.18em"
          color="faint"
          px="10px"
          pb="12px"
        >
          WORKSPACE
        </Text>
      )}

      <Flex direction="column" gap="2px">
        {NAV.map((item) => {
          const active = pathname === item.href;
          return (
            <Flex
              key={item.href}
              asChild
              align="center"
              justify={collapsed ? "center" : "flex-start"}
              gap="12px"
              px={collapsed ? "0" : "12px"}
              py="10px"
              borderRadius="8px"
              fontSize="14px"
              fontWeight={active ? "500" : "400"}
              bg={active ? "raised" : "transparent"}
              color={active ? "text" : "muted"}
              transition="background .12s, color .12s"
              _hover={{ bg: "raised", color: "text" }}
            >
              <NextLink href={item.href} title={collapsed ? item.label : undefined}>
                {item.icon}
                {!collapsed && <Box as="span" whiteSpace="nowrap">{item.label}</Box>}
              </NextLink>
            </Flex>
          );
        })}
      </Flex>

      <chakra.button
        type="button"
        title="Connect a channel"
        mt="18px"
        display="flex"
        alignItems="center"
        justifyContent={collapsed ? "center" : "flex-start"}
        gap="12px"
        px={collapsed ? "0" : "12px"}
        py="10px"
        borderRadius="8px"
        borderWidth="1px"
        borderStyle="dashed"
        borderColor="fieldLine"
        color="muted"
        fontSize="14px"
        textAlign="left"
        cursor="pointer"
        transition="color .12s, border-color .12s"
        _hover={{ color: "text", borderColor: "faint" }}
      >
        <Text fontFamily="mono" fontSize="15px" w="17px" textAlign="center" lineHeight="1">
          +
        </Text>
        {!collapsed && <Box as="span" whiteSpace="nowrap">Connect a channel</Box>}
      </chakra.button>

      <Box mt="auto" px={collapsed ? "0" : "12px"}>
        {!collapsed && (
          <Text
            fontFamily="mono"
            fontSize="10px"
            letterSpacing="0.18em"
            color="faint"
            mb="11px"
          >
            CONNECTED
          </Text>
        )}
        <Flex direction="column" gap="11px" align={collapsed ? "center" : "stretch"}>
          {CONNECTED.map((p) => (
            <Flex
              key={p.name}
              align="center"
              justify={collapsed ? "center" : "flex-start"}
              gap="10px"
              fontSize="13px"
              color="muted"
              title={collapsed ? p.name : undefined}
            >
              <PlatformIcon platform={p.platform} color={p.color} size={15} />
              {!collapsed && <Box as="span" whiteSpace="nowrap">{p.name}</Box>}
            </Flex>
          ))}
        </Flex>
      </Box>

      <ResizeHandle side="right" width={navWidth} onResize={setNavWidth} />
    </Flex>
  );
}
