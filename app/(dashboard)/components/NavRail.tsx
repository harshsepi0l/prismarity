"use client";

import NextLink from "next/link";
import { usePathname } from "next/navigation";
import { Flex, Box, Text, chakra } from "@chakra-ui/react";
import { useLayout } from "../useLayout";
import { ResizeHandle } from "./ResizeHandle";
import { PlatformIcon } from "./PlatformIcon";
import type { Role } from "@/lib/auth/types";

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

// Below this width the rail drops labels and shows icons only.
const COLLAPSE_AT = 168;

interface NavRailProps {
  auth: { displayName: string; role: Role } | null;
}

export function NavRail({ auth }: NavRailProps) {
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

        {auth ? (
          <Flex direction="column" gap="10px" align={collapsed ? "center" : "stretch"}>
            <Flex
              align="center"
              gap="10px"
              justify={collapsed ? "center" : "flex-start"}
              title={collapsed ? auth.displayName : undefined}
            >
              <PlatformIcon platform="twitch" size={18} />
              {!collapsed && (
                <Box minW="0">
                  <Text fontSize="13px" fontWeight="500" color="text" truncate>
                    {auth.displayName}
                  </Text>
                  <Text
                    fontFamily="mono"
                    fontSize="9px"
                    textTransform="uppercase"
                    letterSpacing="0.12em"
                    color="faint"
                  >
                    {auth.role}
                  </Text>
                </Box>
              )}
            </Flex>
            {!collapsed && (
              <chakra.form action="/api/auth/logout" method="post">
                <chakra.button
                  type="submit"
                  fontSize="11px"
                  color="faint"
                  cursor="pointer"
                  transition="color .12s"
                  _hover={{ color: "muted" }}
                >
                  Log out
                </chakra.button>
              </chakra.form>
            )}
          </Flex>
        ) : (
          <chakra.a
            href="/api/auth/twitch/login"
            title="Log in with Twitch"
            display="flex"
            alignItems="center"
            justifyContent="center"
            gap="8px"
            px={collapsed ? "0" : "12px"}
            py="9px"
            borderRadius="8px"
            bg="twitch"
            color="#0E1118"
            fontSize="13px"
            fontWeight="600"
            transition="background .12s"
            _hover={{ bg: "#b885ff" }}
          >
            <PlatformIcon platform="twitch" color="#0E1118" size={16} />
            {!collapsed && <Box as="span" whiteSpace="nowrap">Log in with Twitch</Box>}
          </chakra.a>
        )}
      </Box>

      <ResizeHandle side="right" width={navWidth} onResize={setNavWidth} />
    </Flex>
  );
}
