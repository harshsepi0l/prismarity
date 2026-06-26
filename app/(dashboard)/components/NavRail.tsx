"use client";

import { useState } from "react";
import NextLink from "next/link";
import { usePathname } from "next/navigation";
import { Flex, Box, Text, chakra } from "@chakra-ui/react";
import { useLayout, NAV_COLLAPSE_AT } from "../useLayout";
import { useChat, type KickOnlyChannel } from "../useChat";
import { ResizeHandle } from "./ResizeHandle";
import { PlatformIcon } from "./PlatformIcon";
import { SettingsDialog } from "./SettingsDialog";
import type { FollowedChannel } from "@/lib/twitch/channels";
import type { SearchResult } from "../chat/types";

const CHAT_ICON = (
  <Box
    w="20px"
    h="15px"
    flex="none"
    borderWidth="1.8px"
    borderStyle="solid"
    borderColor="currentColor"
    borderRadius="4px 4px 4px 1px"
  />
);

const LOYALTY_ICON = (
  <Box
    w="16px"
    h="16px"
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
    borderLeft="12px solid currentColor"
    borderTop="7px solid transparent"
    borderBottom="7px solid transparent"
  />
);

const SETTINGS_ICON = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M11.078 2.25c-.917 0-1.699.663-1.85 1.567L9.05 4.889c-.02.12-.115.26-.297.348a7.493 7.493 0 00-.986.57c-.166.115-.334.126-.45.083L6.3 5.508a1.875 1.875 0 00-2.282.819l-.922 1.597a1.875 1.875 0 00.432 2.385l.84.692c.095.078.17.229.154.43a7.598 7.598 0 000 1.139c.015.2-.059.352-.153.43l-.841.692a1.875 1.875 0 00-.432 2.385l.922 1.597a1.875 1.875 0 002.282.818l1.019-.382c.115-.043.283-.031.45.082.312.214.641.405.985.57.182.088.277.228.297.35l.178 1.071c.151.904.933 1.567 1.85 1.567h1.844c.916 0 1.699-.663 1.85-1.567l.178-1.072c.02-.12.114-.26.297-.349.344-.165.673-.356.985-.57.167-.114.335-.125.45-.082l1.02.382a1.875 1.875 0 002.28-.819l.923-1.597a1.875 1.875 0 00-.432-2.385l-.84-.692c-.095-.078-.17-.229-.154-.43a7.614 7.614 0 000-1.139c-.016-.2.059-.352.153-.43l.84-.692c.708-.582.891-1.59.433-2.385l-.922-1.597a1.875 1.875 0 00-2.282-.818l-1.02.382c-.114.043-.282.031-.449-.083a7.49 7.49 0 00-.985-.57c-.183-.087-.277-.227-.297-.348l-.179-1.072a1.875 1.875 0 00-1.85-1.567h-1.843zM12 15.75a3.75 3.75 0 100-7.5 3.75 3.75 0 000 7.5z"
    />
  </svg>
);

const NAV = [
  { href: "/chat", label: "Chat", icon: CHAT_ICON },
  { href: "/loyalty", label: "Loyalty", icon: LOYALTY_ICON },
  { href: "/vods", label: "VODs", icon: VODS_ICON },
];

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
  if (!collapsed) {
    return (
      <chakra.button
        type="button" onClick={onSelect}
        display="flex" alignItems="center" justifyContent="flex-start"
        gap="10px" px="12px" py="8px" w="100%"
        borderRadius="8px" bg={active ? "raised" : "transparent"} color={active ? "text" : "muted"}
        cursor="pointer" transition="background .12s, color .12s" _hover={{ bg: "raised", color: "text" }}
      >
        <PlatformIcon platform="twitch" size={16} />
        <Text flex="1" minW="0" fontSize="13px" textAlign="left" truncate>{ch.displayName}</Text>
        <LiveDot isLive={ch.isLive} viewers={ch.viewerCount} />
      </chakra.button>
    );
  }
  // Icon-only: the button IS the expanding pill — no separate overlay.
  // left: calc(50% - 18px) anchors the icon center at 50% of the nav column.
  return (
    <Box w="100%" h="32px" position="relative">
      <chakra.button
        type="button" onClick={onSelect}
        position="absolute" top="0" left="calc(50% - 19px)"
        display="flex" alignItems="center" gap="8px"
        pl="10px" pr="12px" h="32px"
        borderRadius="20px" maxW="30px" overflow="hidden" whiteSpace="nowrap"
        bg={active ? "raised" : "transparent"} color={active ? "text" : "muted"}
        cursor="pointer"
        transition="max-width 0.5s ease, background .12s, color .12s"
        _hover={{ bg: "raised", color: "text", maxW: "300px" }}
      >
        <Box flex="none" display="flex" alignItems="center"><PlatformIcon platform="twitch" size={18} /></Box>
        <Text flex="none" fontSize="13px">{ch.displayName}</Text>
        <Box flex="none" display="flex" alignItems="center"><LiveDot isLive={ch.isLive} viewers={ch.viewerCount} /></Box>
      </chakra.button>
    </Box>
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
  if (!collapsed) {
    return (
      <chakra.button
        type="button" onClick={onSelect}
        display="flex" alignItems="center" justifyContent="flex-start"
        gap="10px" px="12px" py="8px" w="100%"
        borderRadius="8px" bg={active ? "raised" : "transparent"} color={active ? "text" : "muted"}
        cursor="pointer" transition="background .12s, color .12s" _hover={{ bg: "raised", color: "text" }}
      >
        <PlatformIcon platform="kick" size={16} />
        <Text flex="1" minW="0" fontSize="13px" textAlign="left" truncate>{ch.slug}</Text>
        <LiveDot isLive={ch.isLive} viewers={ch.viewers} />
      </chakra.button>
    );
  }
  return (
    <Box w="100%" h="32px" position="relative">
      <chakra.button
        type="button" onClick={onSelect}
        position="absolute" top="0" left="calc(50% - 19px)"
        display="flex" alignItems="center" gap="8px"
        pl="10px" pr="12px" h="32px"
        borderRadius="20px" maxW="30px" overflow="hidden" whiteSpace="nowrap"
        bg={active ? "raised" : "transparent"} color={active ? "text" : "muted"}
        cursor="pointer"
        transition="max-width 0.5s ease, background .12s, color .12s"
        _hover={{ bg: "raised", color: "text", maxW: "300px" }}
      >
        <Box flex="none" display="flex" alignItems="center"><PlatformIcon platform="kick" size={18} /></Box>
        <Text flex="none" fontSize="13px">{ch.slug}</Text>
        <Box flex="none" display="flex" alignItems="center"><LiveDot isLive={ch.isLive} viewers={ch.viewers} /></Box>
      </chakra.button>
    </Box>
  );
}

// A channel added from search — sits in the CHANNELS section as a tab.
function WatchedChannelButton({
  result,
  active,
  collapsed,
  onSelect,
  onRemove,
}: {
  result: SearchResult;
  active: boolean;
  collapsed: boolean;
  onSelect: () => void;
  onRemove: () => void;
}) {
  const isLive = result.twitch?.isLive || result.kick?.isLive;
  const avatar = result.profileImageUrl;
  const initial = result.displayName[0]?.toUpperCase() ?? "?";

  // Small circular avatar — profile image if available, coloured initial otherwise.
  const Avatar = (
    <Box position="relative" flex="none" w="24px" h="24px">
      {avatar ? (
        <chakra.img
          src={avatar}
          alt={result.displayName}
          w="24px"
          h="24px"
          borderRadius="full"
          objectFit="cover"
        />
      ) : (
        <Flex
          w="24px"
          h="24px"
          borderRadius="full"
          bg="raised"
          align="center"
          justify="center"
          fontSize="10px"
          fontWeight="700"
          color="muted"
        >
          {initial}
        </Flex>
      )}
      {isLive && (
        <Box
          position="absolute"
          bottom="-1px"
          right="-1px"
          w="7px"
          h="7px"
          borderRadius="full"
          bg="#FF5C5C"
          borderWidth="1.5px"
          borderColor="bg"
        />
      )}
    </Box>
  );

  if (!collapsed) {
    return (
      <Flex align="center" gap="3px">
        <chakra.button
          type="button" onClick={onSelect}
          display="flex" alignItems="center" justifyContent="flex-start"
          gap="8px" flex="1" minW="0" px="8px" py="5px"
          borderRadius="8px" bg={active ? "raised" : "transparent"} color={active ? "text" : "muted"}
          cursor="pointer" transition="background .12s, color .12s" _hover={{ bg: "raised", color: "text" }}
        >
          {Avatar}
          <Text flex="1" minW="0" fontSize="12px" textAlign="left" truncate>{result.displayName}</Text>
        </chakra.button>
        <chakra.button
          type="button" onClick={onRemove} title="Remove channel"
          display="flex" alignItems="center" justifyContent="center"
          w="18px" h="18px" flex="none" borderRadius="4px" fontSize="10px"
          color="faint" cursor="pointer" transition="color .12s, background .12s"
          _hover={{ color: "muted", bg: "raised" }}
        >✕</chakra.button>
      </Flex>
    );
  }
  // Avatar is 24px; left: calc(50% - 20px) keeps avatar center at 50%.
  return (
    <Box w="100%" h="34px" position="relative">
      <chakra.button
        type="button" onClick={onSelect}
        position="absolute" top="0" left="calc(50% - 20px)"
        display="flex" alignItems="center" gap="8px"
        pl="8px" pr="12px" h="34px"
        borderRadius="20px" maxW="34px" overflow="hidden" whiteSpace="nowrap"
        bg={active ? "raised" : "transparent"} color={active ? "text" : "muted"}
        cursor="pointer"
        transition="max-width 0.5s ease, background .12s, color .12s"
        _hover={{ bg: "raised", color: "text", maxW: "300px" }}
      >
        {Avatar}
        <Text flex="none" fontSize="12px">{result.displayName}</Text>
        {isLive && <Box flex="none" w="6px" h="6px" borderRadius="full" bg="#FF5C5C" />}
      </chakra.button>
    </Box>
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
  if (!collapsed) {
    return (
      <Flex align="center" gap="10px">
        <PlatformIcon platform={platform} size={18} />
        <Text minW="0" fontSize="13px" fontWeight="500" color="text" truncate>{name}</Text>
      </Flex>
    );
  }
  return (
    <Box w="100%" h="28px" position="relative">
      <Flex
        align="center" gap="8px"
        position="absolute" top="0" left="calc(50% - 14px)"
        pl="5px" pr="12px" h="28px"
        borderRadius="20px" maxW="25px" overflow="hidden"
        whiteSpace="nowrap" color="text"
        transition="max-width 0.5s ease"
        _hover={{ maxW: "300px", bg: "raised" }}
        style={{ cursor: "default" }}
      >
        <Box flex="none" display="flex" alignItems="center"><PlatformIcon platform={platform} size={18} /></Box>
        <Text flex="none" fontSize="13px" fontWeight="500">{name}</Text>
      </Flex>
    </Box>
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
  if (!collapsed) {
    return (
      <chakra.a
        href={href} display="flex" alignItems="center" justifyContent="center"
        gap="8px" px="12px" py="9px" borderRadius="8px"
        bg={bg} color="#0E1118" fontSize="13px" fontWeight="600"
        transition="filter .12s" _hover={{ filter: "brightness(1.1)" }}
      >
        <PlatformIcon platform={platform} color="#0E1118" size={16} />
        <Box as="span" whiteSpace="nowrap">{label}</Box>
      </chakra.a>
    );
  }
  return (
    <Box w="100%" h="34px" position="relative">
      <chakra.a
        href={href}
        position="absolute" top="0" left="calc(50% - 19px)"
        display="flex" alignItems="center" gap="8px"
        pl="10px" pr="12px" h="34px"
        borderRadius="20px" maxW="30px" overflow="hidden" whiteSpace="nowrap"
        bg={bg} color="#0E1118" fontSize="13px" fontWeight="600"
        transition="max-width 0.5s ease, filter .12s"
        _hover={{ filter: "brightness(1.1)", maxW: "300px" }}
      >
        <Box flex="none" display="flex" alignItems="center"><PlatformIcon platform={platform} color="#0E1118" size={18} /></Box>
        <Box as="span" flex="none" whiteSpace="nowrap">{label}</Box>
      </chakra.a>
    </Box>
  );
}

export function NavRail({ auth }: NavRailProps) {
  const pathname = usePathname();
  const { navWidth, setNavWidth } = useLayout();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const {
    ownChannel,
    ownKick,
    activeChannel,
    activeKickOnly,
    activeRole,
    watchedChannels,
    selectChannel,
    selectKickOnly,
    selectSearchResult,
    clearSelection,
    removeWatchedChannel,
  } = useChat();

  const iconOnly = navWidth > 0 && navWidth < NAV_COLLAPSE_AT;
  const showWorkspace = activeRole !== "viewer";

  // Always render a single Flex so the ResizeHandle stays in the same DOM node
  // across width=0 ↔ width>0 transitions — pointer capture survives the re-render.
  return (
    <Flex
      as="nav"
      position="relative"
      flex="none"
      w={`${navWidth}px`}
      direction="column"
      borderRightWidth={navWidth > 0 ? "1px" : "0"}
      borderColor="line"
      px={iconOnly ? "10px" : "14px"}
      py={navWidth > 0 ? "22px" : "0"}
      style={{
        overflow: navWidth < NAV_COLLAPSE_AT ? "visible" : "hidden",
        pointerEvents: navWidth === 0 ? "none" : undefined,
      }}
    >
      {navWidth > 0 && (
        <>
          <Flex justify={iconOnly ? "center" : "flex-start"} align="center" mb="14px">
            <chakra.button
              type="button"
              onClick={() => setSettingsOpen(true)}
              title="Settings"
              display="flex"
              alignItems="center"
              justifyContent="center"
              w="28px"
              h="28px"
              borderRadius="6px"
              color="faint"
              cursor="pointer"
              transition="color .12s, background .12s"
              _hover={{ color: "muted", bg: "raised" }}
            >
              {SETTINGS_ICON}
            </chakra.button>
          </Flex>

          <Box mb="20px">
            {!iconOnly && <SectionLabel>YOUR CHANNELS</SectionLabel>}
            <Flex direction="column" gap="8px" align={iconOnly ? "center" : "stretch"}>
              {auth.twitch ? (
                ownChannel ? (
                  <OwnTwitchButton
                    ch={ownChannel}
                    active={activeChannel?.id === ownChannel.id}
                    collapsed={iconOnly}
                    onSelect={() => selectChannel(ownChannel)}
                  />
                ) : (
                  <IdentityRow platform="twitch" name={auth.twitch.displayName} collapsed={iconOnly} />
                )
              ) : (
                <ConnectButton platform="twitch" href="/api/auth/twitch/login" label="Connect Twitch" bg="twitch" collapsed={iconOnly} />
              )}

              {auth.kick ? (
                ownKick ? (
                  <OwnKickButton
                    ch={ownKick}
                    active={activeKickOnly === ownKick.slug}
                    collapsed={iconOnly}
                    onSelect={() => selectKickOnly(ownKick.slug)}
                  />
                ) : (
                  <IdentityRow platform="kick" name={auth.kick.displayName} collapsed={iconOnly} />
                )
              ) : (
                <ConnectButton platform="kick" href="/api/auth/kick/login" label="Connect Kick" bg="#5BE37D" collapsed={iconOnly} />
              )}

              {(auth.twitch || auth.kick) && !iconOnly && (
                <chakra.form action="/api/auth/logout" method="post">
                  <chakra.button type="submit" fontSize="11px" color="faint" cursor="pointer" transition="color .12s" _hover={{ color: "muted" }}>
                    Log out
                  </chakra.button>
                </chakra.form>
              )}
            </Flex>
          </Box>

          {watchedChannels.length > 0 && (
            <Box mb="20px">
              {!iconOnly && <SectionLabel>CHANNELS</SectionLabel>}
              <Flex direction="column" gap="2px" align={iconOnly ? "center" : "stretch"}>
                {watchedChannels.map((result) => {
                  const active =
                    (!!result.twitch && activeChannel?.id === result.twitch.id) ||
                    (!!result.kick && activeKickOnly === result.kick.slug.toLowerCase());
                  return (
                    <WatchedChannelButton
                      key={result.handle}
                      result={result}
                      active={active}
                      collapsed={iconOnly}
                      onSelect={() => selectSearchResult(result)}
                      onRemove={() => {
                        if (active) {
                          const idx = watchedChannels.findIndex((c) => c.handle === result.handle);
                          const prev = idx > 0 ? watchedChannels[idx - 1] : null;
                          if (prev) selectSearchResult(prev);
                          else clearSelection();
                        }
                        removeWatchedChannel(result.handle);
                      }}
                    />
                  );
                })}
              </Flex>
            </Box>
          )}

          {showWorkspace && (
            <>
              {!iconOnly && <SectionLabel>WORKSPACE</SectionLabel>}
              <Flex direction="column" gap="2px">
                {NAV.map((item) => {
                  const active = pathname === item.href;
                  if (!iconOnly) {
                    return (
                      <Flex
                        key={item.href} asChild
                        align="center" justify="flex-start" gap="12px"
                        px="12px" py="10px" borderRadius="8px" fontSize="14px"
                        fontWeight={active ? "500" : "400"}
                        bg={active ? "raised" : "transparent"} color={active ? "text" : "muted"}
                        transition="background .12s, color .12s" _hover={{ bg: "raised", color: "text" }}
                      >
                        <NextLink href={item.href}>
                          {item.icon}
                          <Box as="span" whiteSpace="nowrap">{item.label}</Box>
                        </NextLink>
                      </Flex>
                    );
                  }
                  // Icon-only: single expanding link anchored at icon center.
                  return (
                    <Box key={item.href} w="100%" h="36px" position="relative">
                      <Flex
                        asChild align="center" gap="10px"
                        position="absolute" top="0" left="calc(50% - 16px)"
                        pl="8px" pr="12px" h="36px"
                        borderRadius="20px" maxW="26px" overflow="hidden" whiteSpace="nowrap"
                        fontSize="14px" fontWeight={active ? "500" : "400"}
                        bg={active ? "raised" : "transparent"} color={active ? "text" : "muted"}
                        transition="max-width 0.5s ease, background .12s, color .12s"
                        _hover={{ bg: "raised", color: "text", maxW: "300px" }}
                      >
                        <NextLink href={item.href}>
                          <Box flex="none" display="flex" alignItems="center">{item.icon}</Box>
                          <Box as="span" flex="none">{item.label}</Box>
                        </NextLink>
                      </Flex>
                    </Box>
                  );
                })}
              </Flex>
            </>
          )}

          <Box flex="1" minH="18px" />
        </>
      )}

      <ResizeHandle side="right" width={navWidth} onResize={setNavWidth} />

      {settingsOpen && (
        <SettingsDialog auth={auth} onClose={() => setSettingsOpen(false)} />
      )}
    </Flex>
  );
}
