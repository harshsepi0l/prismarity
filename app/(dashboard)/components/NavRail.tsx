"use client";

import { useEffect, useMemo, useState } from "react";
import NextLink from "next/link";
import { usePathname } from "next/navigation";
import { Flex, Box, Text, Input, chakra } from "@chakra-ui/react";
import { useLayout } from "../useLayout";
import { useChat } from "../useChat";
import { ResizeHandle } from "./ResizeHandle";
import { PlatformIcon } from "./PlatformIcon";
import type { FollowedChannel } from "@/lib/twitch/channels";

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

type SortKey = "live" | "viewers" | "name";
const SORTS: { key: SortKey; label: string }[] = [
  { key: "live", label: "Live" },
  { key: "viewers", label: "Views" },
  { key: "name", label: "A–Z" },
];
const SORT_STORAGE_KEY = "prismarity:followed-sort";

function compareChannels(a: FollowedChannel, b: FollowedChannel, sort: SortKey): number {
  if (sort === "name") return a.displayName.localeCompare(b.displayName);
  if (sort === "viewers")
    return b.viewerCount - a.viewerCount || a.displayName.localeCompare(b.displayName);
  // "live": live first, then by viewers, then name.
  return (
    Number(b.isLive) - Number(a.isLive) ||
    b.viewerCount - a.viewerCount ||
    a.displayName.localeCompare(b.displayName)
  );
}

function ChannelButton({
  ch,
  active,
  collapsed,
  onSelect,
}: {
  ch: FollowedChannel;
  active: boolean;
  collapsed: boolean;
  onSelect: () => void;
}) {
  return (
    <chakra.button
      type="button"
      onClick={onSelect}
      title={collapsed ? ch.displayName : undefined}
      display="flex"
      alignItems="center"
      justifyContent={collapsed ? "center" : "flex-start"}
      gap="10px"
      px={collapsed ? "0" : "12px"}
      py="8px"
      borderRadius="8px"
      bg={active ? "raised" : "transparent"}
      color={active ? "text" : "muted"}
      cursor="pointer"
      transition="background .12s, color .12s"
      _hover={{ bg: "raised", color: "text" }}
    >
      <PlatformIcon platform="twitch" size={16} />
      {!collapsed && (
        <>
          <Text flex="1" minW="0" fontSize="13px" textAlign="left" truncate>
            {ch.displayName}
          </Text>
          {ch.isLive ? (
            <Flex align="center" gap="5px" flex="none">
              <Box w="6px" h="6px" borderRadius="full" bg="#FF5C5C" />
              <Text fontFamily="mono" fontSize="11px" color="muted">
                {ch.viewerCount.toLocaleString()}
              </Text>
            </Flex>
          ) : (
            <Text fontFamily="mono" fontSize="10px" color="faint" flex="none">
              offline
            </Text>
          )}
        </>
      )}
    </chakra.button>
  );
}

interface NavRailProps {
  auth: { displayName: string } | null;
}

export function NavRail({ auth }: NavRailProps) {
  const pathname = usePathname();
  const { navWidth, setNavWidth } = useLayout();
  const { ownChannel, followedChannels, activeChannel, selectChannel } = useChat();
  const collapsed = navWidth < COLLAPSE_AT;
  // Workspace (Chat / Loyalty / VODs) is management — only on channels you
  // own or moderate.
  const showWorkspace = (activeChannel?.role ?? "viewer") !== "viewer";

  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("live");

  // Persist the sort preference; the search query stays in-memory.
  useEffect(() => {
    const saved = localStorage.getItem(SORT_STORAGE_KEY);
    if (saved === "live" || saved === "viewers" || saved === "name") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSort(saved);
    }
  }, []);

  function changeSort(key: SortKey) {
    setSort(key);
    localStorage.setItem(SORT_STORAGE_KEY, key);
  }

  const visibleChannels = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? followedChannels.filter(
          (c) =>
            c.displayName.toLowerCase().includes(q) || c.login.toLowerCase().includes(q)
        )
      : followedChannels;
    return [...filtered].sort((a, b) => compareChannels(a, b, sort));
  }, [followedChannels, query, sort]);

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
      {showWorkspace && (
        <>
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
        </>
      )}

      {/* Your own channel — selecting it unlocks Creator mode. */}
      {ownChannel && (
        <Box mt="18px">
          {!collapsed && (
            <Text
              fontFamily="mono"
              fontSize="10px"
              letterSpacing="0.18em"
              color="faint"
              px="10px"
              pb="12px"
            >
              YOUR CHANNEL
            </Text>
          )}
          <ChannelButton
            ch={ownChannel}
            active={activeChannel?.id === ownChannel.id}
            collapsed={collapsed}
            onSelect={() => selectChannel(ownChannel)}
          />
        </Box>
      )}

      {/* Followed channels — click one to view its chat. */}
      <Flex direction="column" flex="1" minH="0" mt="18px">
        {!collapsed && (
          <Text
            fontFamily="mono"
            fontSize="10px"
            letterSpacing="0.18em"
            color="faint"
            px="10px"
            pb="12px"
          >
            FOLLOWED
          </Text>
        )}

        {!collapsed && followedChannels.length > 0 && (
          <Flex direction="column" gap="8px" px="12px" pb="10px">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter channels…"
              h="30px"
              fontSize="12px"
              bg="field"
              borderColor="fieldLine"
              borderRadius="8px"
              color="text"
              _placeholder={{ color: "faint" }}
              _focusVisible={{ borderColor: "muted", boxShadow: "none" }}
            />
            <Flex gap="4px">
              {SORTS.map((sortOption) => (
                <chakra.button
                  key={sortOption.key}
                  type="button"
                  onClick={() => changeSort(sortOption.key)}
                  flex="1"
                  py="4px"
                  borderRadius="6px"
                  borderWidth="1px"
                  fontFamily="mono"
                  fontSize="11px"
                  cursor="pointer"
                  transition="background .12s, color .12s"
                  bg={sort === sortOption.key ? "raised" : "transparent"}
                  color={sort === sortOption.key ? "text" : "faint"}
                  borderColor={sort === sortOption.key ? "line" : "transparent"}
                  _hover={sort === sortOption.key ? undefined : { color: "muted" }}
                >
                  {sortOption.label}
                </chakra.button>
              ))}
            </Flex>
          </Flex>
        )}

        <Flex direction="column" gap="2px" overflowY="auto" minH="0">
          {followedChannels.length === 0 && !collapsed && (
            <Text fontSize="12px" color="faint" px="12px">
              {auth ? "No followed channels" : "Log in to see your channels"}
            </Text>
          )}
          {followedChannels.length > 0 && visibleChannels.length === 0 && !collapsed && (
            <Text fontSize="12px" color="faint" px="12px">
              No matches
            </Text>
          )}
          {visibleChannels.map((ch) => (
            <ChannelButton
              key={ch.id}
              ch={ch}
              active={activeChannel?.id === ch.id}
              collapsed={collapsed}
              onSelect={() => selectChannel(ch)}
            />
          ))}
        </Flex>
      </Flex>

      <Box px={collapsed ? "0" : "12px"} pt="16px">
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
                <Text minW="0" fontSize="13px" fontWeight="500" color="text" truncate>
                  {auth.displayName}
                </Text>
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
