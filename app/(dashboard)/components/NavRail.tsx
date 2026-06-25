"use client";

import NextLink from "next/link";
import { usePathname } from "next/navigation";
import { Flex, Box, Text, chakra } from "@chakra-ui/react";
import { useLayout } from "../useLayout";
import { useChat, type KickOnlyChannel } from "../useChat";
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

const SectionLabel = ({ children }: { children: React.ReactNode }) => (
  <Text
    fontFamily="mono"
    fontSize="10px"
    letterSpacing="0.18em"
    color="faint"
    px="10px"
    pb="12px"
  >
    {children}
  </Text>
);

function CollapseToggle({ hidden, onClick }: { hidden: boolean; onClick: () => void }) {
  return (
    <chakra.button
      type="button"
      onClick={onClick}
      title={hidden ? "Show sidebar" : "Hide sidebar"}
      aria-label={hidden ? "Show sidebar" : "Hide sidebar"}
      display="flex"
      alignItems="center"
      justifyContent="center"
      h="28px"
      w="28px"
      flex="none"
      borderRadius="7px"
      color="muted"
      cursor="pointer"
      transition="background .12s, color .12s"
      _hover={{ bg: "raised", color: "text" }}
    >
      <svg width="15" height="15" viewBox="0 0 20 20" fill="none" aria-hidden>
        <path
          d={hidden ? "M7 4 L13 10 L7 16" : "M13 4 L7 10 L13 16"}
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </chakra.button>
  );
}

// A live/offline indicator with viewer count.
function LiveDot({ isLive, viewers }: { isLive: boolean; viewers?: number }) {
  if (isLive) {
    return (
      <Flex align="center" gap="5px" flex="none">
        <Box w="6px" h="6px" borderRadius="full" bg="#FF5C5C" />
        {viewers != null && (
          <Text fontFamily="mono" fontSize="11px" color="muted">
            {viewers.toLocaleString()}
          </Text>
        )}
      </Flex>
    );
  }
  return (
    <Text fontFamily="mono" fontSize="10px" color="faint" flex="none">
      offline
    </Text>
  );
}

// Your own Twitch channel row (creator).
function OwnTwitchButton({
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
          <LiveDot isLive={ch.isLive} viewers={ch.viewerCount} />
        </>
      )}
    </chakra.button>
  );
}

// Your own Kick channel row (creator) — when Twitch isn't connected.
function OwnKickButton({
  ch,
  active,
  collapsed,
  onSelect,
}: {
  ch: KickOnlyChannel;
  active: boolean;
  collapsed: boolean;
  onSelect: () => void;
}) {
  return (
    <chakra.button
      type="button"
      onClick={onSelect}
      title={collapsed ? ch.slug : undefined}
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
      <PlatformIcon platform="kick" size={16} />
      {!collapsed && (
        <>
          <Text flex="1" minW="0" fontSize="13px" textAlign="left" truncate>
            {ch.slug}
          </Text>
          <LiveDot isLive={ch.isLive} viewers={ch.viewers} />
        </>
      )}
    </chakra.button>
  );
}

interface NavRailProps {
  auth: {
    twitch: { displayName: string } | null;
    kick: { displayName: string } | null;
  };
}

function IdentityRow({
  platform,
  name,
  collapsed,
}: {
  platform: "twitch" | "kick";
  name: string;
  collapsed: boolean;
}) {
  return (
    <Flex
      align="center"
      gap="10px"
      justify={collapsed ? "center" : "flex-start"}
      title={collapsed ? name : undefined}
    >
      <PlatformIcon platform={platform} size={18} />
      {!collapsed && (
        <Text minW="0" fontSize="13px" fontWeight="500" color="text" truncate>
          {name}
        </Text>
      )}
    </Flex>
  );
}

function ConnectButton({
  href,
  label,
  platform,
  bg,
  collapsed,
}: {
  href: string;
  label: string;
  platform: "twitch" | "kick";
  bg: string;
  collapsed: boolean;
}) {
  return (
    <chakra.a
      href={href}
      title={label}
      display="flex"
      alignItems="center"
      justifyContent="center"
      gap="8px"
      px={collapsed ? "0" : "12px"}
      py="9px"
      borderRadius="8px"
      bg={bg}
      color="#0E1118"
      fontSize="13px"
      fontWeight="600"
      transition="filter .12s"
      _hover={{ filter: "brightness(1.1)" }}
    >
      <PlatformIcon platform={platform} color="#0E1118" size={16} />
      {!collapsed && (
        <Box as="span" whiteSpace="nowrap">
          {label}
        </Box>
      )}
    </chakra.a>
  );
}

export function NavRail({ auth }: NavRailProps) {
  const pathname = usePathname();
  const { navWidth, setNavWidth, navHidden, toggleNav } = useLayout();
  const {
    ownChannel,
    ownKick,
    activeChannel,
    activeKickOnly,
    activeRole,
    selectChannel,
    selectKickOnly,
  } = useChat();
  const collapsed = navWidth < COLLAPSE_AT;

  // Workspace (Chat / Loyalty / VODs) is management — only on channels you own
  // or moderate (on either platform).
  const showWorkspace = activeRole !== "viewer";

  // Hidden trades the full rail for a slim strip — the toggle plus the two
  // platform glyphs — so the sidebar is never fully gone, just minimized.
  if (navHidden) {
    return (
      <Flex
        as="nav"
        direction="column"
        align="center"
        flex="none"
        w="52px"
        borderRightWidth="1px"
        borderColor="line"
        py="22px"
        gap="14px"
      >
        <CollapseToggle hidden onClick={toggleNav} />
        <Box w="22px" h="1px" bg="line" />
        <PlatformIcon platform="twitch" size={20} />
        <PlatformIcon platform="kick" size={20} />
      </Flex>
    );
  }

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
      <Flex justify={collapsed ? "center" : "flex-end"} mb="14px">
        <CollapseToggle hidden={false} onClick={toggleNav} />
      </Flex>

      {/* Your own channel — selecting it unlocks Creator mode. */}
      <Box mb="20px">
        {!collapsed && <SectionLabel>YOUR CHANNELS</SectionLabel>}
        <Flex direction="column" gap="8px" align={collapsed ? "center" : "stretch"}>
          {auth.twitch ? (
            ownChannel ? (
              <OwnTwitchButton
                ch={ownChannel}
                active={activeChannel?.id === ownChannel.id}
                collapsed={collapsed}
                onSelect={() => selectChannel(ownChannel)}
              />
            ) : (
              <IdentityRow platform="twitch" name={auth.twitch.displayName} collapsed={collapsed} />
            )
          ) : (
            <ConnectButton
              platform="twitch"
              href="/api/auth/twitch/login"
              label="Connect Twitch"
              bg="twitch"
              collapsed={collapsed}
            />
          )}

          {auth.kick ? (
            ownKick ? (
              <OwnKickButton
                ch={ownKick}
                active={activeKickOnly === ownKick.slug}
                collapsed={collapsed}
                onSelect={() => selectKickOnly(ownKick.slug)}
              />
            ) : (
              <IdentityRow platform="kick" name={auth.kick.displayName} collapsed={collapsed} />
            )
          ) : (
            <ConnectButton
              platform="kick"
              href="/api/auth/kick/login"
              label="Connect Kick"
              bg="#5BE37D"
              collapsed={collapsed}
            />
          )}

          {(auth.twitch || auth.kick) && !collapsed && (
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
      </Box>

      {showWorkspace && (
        <>
          {!collapsed && <SectionLabel>WORKSPACE</SectionLabel>}

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

      <Box flex="1" minH="18px" />

      <ResizeHandle side="right" width={navWidth} onResize={setNavWidth} />
    </Flex>
  );
}
