"use client";

import { useEffect, useMemo, useState } from "react";
import NextLink from "next/link";
import { usePathname } from "next/navigation";
import { Flex, Box, Text, Input, chakra } from "@chakra-ui/react";
import { useLayout } from "../useLayout";
import { useChat, type KickOnlyChannel } from "../useChat";
import { useSession } from "../useSession";
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
  kickMatched = false,
  onSelect,
}: {
  ch: FollowedChannel;
  active: boolean;
  collapsed: boolean;
  kickMatched?: boolean;
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
      {/* Merged identity: both logos when the same handle exists on Kick. */}
      <Flex align="center" gap="3px" flex="none">
        <PlatformIcon platform="twitch" size={16} />
        {kickMatched && <PlatformIcon platform="kick" size={14} />}
      </Flex>
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

function KickChannelButton({
  ch,
  active,
  collapsed,
  onSelect,
  onRemove,
}: {
  ch: KickOnlyChannel;
  active: boolean;
  collapsed: boolean;
  onSelect: () => void;
  onRemove?: () => void;
}) {
  return (
    <Flex align="center" gap="2px">
      <chakra.button
        type="button"
        onClick={onSelect}
        title={collapsed ? ch.slug : undefined}
        flex="1"
        minW="0"
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
            {ch.isLive ? (
              <Flex align="center" gap="5px" flex="none">
                <Box w="6px" h="6px" borderRadius="full" bg="#FF5C5C" />
                <Text fontFamily="mono" fontSize="11px" color="muted">
                  {ch.viewers.toLocaleString()}
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
      {!collapsed && onRemove && (
        <chakra.button
          type="button"
          onClick={onRemove}
          title="Remove Kick channel"
          flex="none"
          px="6px"
          py="8px"
          color="faint"
          cursor="pointer"
          fontSize="12px"
          transition="color .12s"
          _hover={{ color: "#FF5C5C" }}
        >
          ✕
        </chakra.button>
      )}
    </Flex>
  );
}

// Add-a-Kick-channel input for the Kick-only section.
function AddKick({ onAdd }: { onAdd: (slug: string) => void }) {
  const [value, setValue] = useState("");
  function submit() {
    const v = value.trim();
    if (v) onAdd(v);
    setValue("");
  }
  return (
    <Flex align="center" gap="6px" px="12px" pb="8px">
      <PlatformIcon platform="kick" color="#5BE37D" size={13} />
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") submit();
        }}
        placeholder="Add Kick channel…"
        h="28px"
        fontSize="12px"
        bg="field"
        borderColor="fieldLine"
        borderRadius="8px"
        color="text"
        _placeholder={{ color: "faint" }}
        _focusVisible={{ borderColor: "muted", boxShadow: "none" }}
      />
    </Flex>
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

// Cross-platform link editor shown under the active channel: resolve/override
// which Kick channel this Twitch channel maps to. The link is user-managed state.
function KickLink({ channel }: { channel: FollowedChannel }) {
  const { activeKick, getLink, setLink, clearLink } = useChat();
  const link = getLink(channel.id); // string | null | undefined
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");

  function start() {
    setValue(activeKick?.slug ?? channel.login);
    setEditing(true);
  }
  function save() {
    const v = value.trim().toLowerCase().replace(/^@/, "");
    if (v) setLink(channel.id, v);
    setEditing(false);
  }

  if (editing) {
    return (
      <Flex align="center" gap="6px" pl="12px" pr="4px" py="6px">
        <PlatformIcon platform="kick" color="#5BE37D" size={12} />
        <Input
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") save();
            if (e.key === "Escape") setEditing(false);
          }}
          placeholder="kick slug"
          h="24px"
          fontSize="11px"
          bg="field"
          borderColor="fieldLine"
          borderRadius="6px"
          color="text"
          _placeholder={{ color: "faint" }}
          _focusVisible={{ borderColor: "muted", boxShadow: "none" }}
        />
        <chakra.button type="button" onClick={save} title="Save" color="#5BE37D" cursor="pointer" fontSize="13px">
          ✓
        </chakra.button>
        <chakra.button
          type="button"
          onClick={() => setEditing(false)}
          title="Cancel"
          color="faint"
          cursor="pointer"
          fontSize="12px"
          _hover={{ color: "muted" }}
        >
          ✕
        </chakra.button>
      </Flex>
    );
  }

  const label = activeKick ? activeKick.slug : link === null ? "off" : "not linked";
  return (
    <Flex align="center" gap="7px" pl="12px" pr="4px" py="5px" fontFamily="mono" fontSize="10px">
      <PlatformIcon platform="kick" color="#5BE37D" size={12} />
      <Text flex="1" minW="0" truncate color={activeKick ? "muted" : "faint"}>
        {label}
      </Text>
      <chakra.button
        type="button"
        onClick={start}
        title="Link a Kick channel"
        color="faint"
        cursor="pointer"
        _hover={{ color: "muted" }}
      >
        edit
      </chakra.button>
      {activeKick && (
        <chakra.button
          type="button"
          onClick={() => setLink(channel.id, null)}
          title="Unlink Kick"
          color="faint"
          cursor="pointer"
          _hover={{ color: "#FF5C5C" }}
        >
          ✕
        </chakra.button>
      )}
      {link === null && (
        <chakra.button
          type="button"
          onClick={() => clearLink(channel.id)}
          title="Reset to auto-match"
          color="faint"
          cursor="pointer"
          _hover={{ color: "muted" }}
        >
          auto
        </chakra.button>
      )}
    </Flex>
  );
}

export function NavRail({ auth }: NavRailProps) {
  const pathname = usePathname();
  const { navWidth, setNavWidth } = useLayout();
  const {
    ownChannel,
    followedChannels,
    activeChannel,
    activeKickOnly,
    activeRole,
    selectChannel,
    selectKickOnly,
    kickConnected,
    ownKick,
    kickSlugFor,
    manualKick,
    addManualKick,
    removeManualKick,
  } = useChat();
  const { activeFilters } = useSession();
  const collapsed = navWidth < COLLAPSE_AT;
  // Workspace (Chat / Loyalty / VODs) is management — only on channels you
  // own or moderate (on either platform).
  const showWorkspace = activeRole !== "viewer";

  // The platform chips are the lens: a platform toggled off disappears from the
  // channel list entirely. Sections show only when connected AND toggled on.
  const twitchOn = activeFilters.has("twitch");
  const kickOn = activeFilters.has("kick");
  const showFollowed = !!auth.twitch && twitchOn;
  const showKick = kickConnected && kickOn;

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

      {/* Your own channel — selecting it unlocks Creator mode. Twitch own when
          connected (merges your Kick channel onto the same row); otherwise your
          standalone Kick channel. */}
      {((showFollowed && ownChannel) || (showKick && ownKick)) && (
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
          {showFollowed && ownChannel ? (
            <>
              <ChannelButton
                ch={ownChannel}
                active={activeChannel?.id === ownChannel.id}
                collapsed={collapsed}
                kickMatched={showKick && !!kickSlugFor(ownChannel)}
                onSelect={() => selectChannel(ownChannel)}
              />
              {activeChannel?.id === ownChannel.id && showKick && !collapsed && (
                <KickLink channel={ownChannel} />
              )}
            </>
          ) : (
            showKick &&
            ownKick && (
              <KickChannelButton
                ch={ownKick}
                active={activeKickOnly === ownKick.slug}
                collapsed={collapsed}
                onSelect={() => selectKickOnly(ownKick.slug)}
              />
            )
          )}
        </Box>
      )}

      {/* Followed channels (Twitch) — only when Twitch is connected AND its
          chip is toggled on (the lens). */}
      {showFollowed && (
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
              No followed channels
            </Text>
          )}
          {followedChannels.length > 0 && visibleChannels.length === 0 && !collapsed && (
            <Text fontSize="12px" color="faint" px="12px">
              No matches
            </Text>
          )}
          {visibleChannels.map((ch) => {
            const active = activeChannel?.id === ch.id;
            return (
              <Box key={ch.id}>
                <ChannelButton
                  ch={ch}
                  active={active}
                  collapsed={collapsed}
                  kickMatched={showKick && !!kickSlugFor(ch)}
                  onSelect={() => selectChannel(ch)}
                />
                {active && showKick && !collapsed && <KickLink channel={ch} />}
              </Box>
            );
          })}
        </Flex>
      </Flex>
      )}

      {/* Kick-only channels — Kick has no follows API, so these are curated.
          Twitch follows that also exist on Kick merge into the rows above.
          Grows to fill when the Twitch list isn't shown. */}
      {showKick && (
        <Flex
          direction="column"
          flex={showFollowed ? "none" : "1"}
          mt="14px"
          maxH={showFollowed ? "38%" : undefined}
          minH="0"
        >
          {!collapsed && (
            <Flex align="center" gap="7px" px="10px" pb="12px">
              <PlatformIcon platform="kick" color="#5BE37D" size={12} />
              <Text fontFamily="mono" fontSize="10px" letterSpacing="0.18em" color="faint">
                KICK
              </Text>
            </Flex>
          )}
          {!collapsed && <AddKick onAdd={addManualKick} />}
          <Flex direction="column" gap="2px" overflowY="auto" minH="0">
            {manualKick.length === 0 && !collapsed && (
              <Text fontSize="12px" color="faint" px="12px">
                Add Kick channels you follow
              </Text>
            )}
            {manualKick.map((kc) => (
              <KickChannelButton
                key={kc.slug}
                ch={kc}
                active={activeKickOnly === kc.slug}
                collapsed={collapsed}
                onSelect={() => selectKickOnly(kc.slug)}
                onRemove={() => removeManualKick(kc.slug)}
              />
            ))}
          </Flex>
        </Flex>
      )}

      {/* Keep CONNECTED pinned to the bottom when no list above grows. */}
      {!showFollowed && !showKick && <Box flex="1" />}

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

        <Flex direction="column" gap="10px" align={collapsed ? "center" : "stretch"}>
          {auth.twitch ? (
            <IdentityRow platform="twitch" name={auth.twitch.displayName} collapsed={collapsed} />
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
            <IdentityRow platform="kick" name={auth.kick.displayName} collapsed={collapsed} />
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

      <ResizeHandle side="right" width={navWidth} onResize={setNavWidth} />
    </Flex>
  );
}
