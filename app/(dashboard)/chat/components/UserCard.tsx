"use client";

import { useEffect, useState } from "react";
import { Box, Flex, Text, chakra } from "@chakra-ui/react";
import type { ChatMessage as ChatMessageType, UserSelection } from "../../types";
import { PlatformIcon, PLATFORM_COLOR } from "../../components/PlatformIcon";
import { BadgeChip } from "./ChatMessage";

interface TwitchUserInfo {
  login: string;
  displayName: string;
  profileImageUrl: string;
  createdAt: string;
  broadcasterType: string;
}

function formatJoinDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

function CloseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path
        d="M2 2 L12 12 M12 2 L2 12"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

interface UserCardProps {
  selection: UserSelection | null;
  onClose: () => void;
  messages: ChatMessageType[];
}

// A click-to-view card for a chatter, similar to Twitch's viewer card: avatar,
// account age, badges, and their recent messages from this session.
export function UserCard({ selection, onClose, messages }: UserCardProps) {
  const [info, setInfo] = useState<TwitchUserInfo | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    setInfo(null);
    if (!selection || selection.platform !== "twitch" || !selection.userId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    /* eslint-enable react-hooks/set-state-in-effect */
    let cancelled = false;
    fetch(`/api/twitch/user?id=${selection.userId}`)
      .then((r) => (r.ok ? r.json() : { user: null }))
      .then((json: { user?: TwitchUserInfo | null }) => {
        if (!cancelled) setInfo(json.user ?? null);
      })
      .catch(() => {
        /* ignore */
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selection]);

  if (!selection) return null;

  const color = PLATFORM_COLOR[selection.platform] ?? "#8B93A7";

  // Latest badges this user is holding, from their most recent message.
  const latestBadges =
    [...messages].reverse().find((m) => m.platform === selection.platform && m.user === selection.user)
      ?.badges ?? [];

  const recent = messages
    .filter((m) => m.platform === selection.platform && m.user === selection.user)
    .slice(-5);

  return (
    <Flex
      position="fixed"
      inset="0"
      align="center"
      justify="center"
      bg="rgba(0,0,0,0.5)"
      zIndex={50}
      onClick={onClose}
    >
      <Box
        onClick={(e) => e.stopPropagation()}
        bg="panel"
        borderWidth="1px"
        borderColor="line"
        borderRadius="12px"
        w="320px"
        maxH="80vh"
        overflowY="auto"
        p="20px"
      >
        <Flex justify="flex-end" mb="2px">
          <chakra.button
            type="button"
            onClick={onClose}
            color="faint"
            cursor="pointer"
            display="flex"
            _hover={{ color: "text" }}
          >
            <CloseIcon />
          </chakra.button>
        </Flex>

        <Flex direction="column" align="center" gap="10px" mb="16px">
          {info?.profileImageUrl ? (
            <chakra.img
              src={info.profileImageUrl}
              alt={selection.user}
              w="64px"
              h="64px"
              borderRadius="full"
            />
          ) : (
            <Flex
              w="64px"
              h="64px"
              borderRadius="full"
              bg="raised"
              align="center"
              justify="center"
              fontSize="22px"
              fontWeight="700"
              color={color}
            >
              {selection.user.charAt(0).toUpperCase()}
            </Flex>
          )}
          <Flex align="center" gap="6px">
            <PlatformIcon platform={selection.platform} color={color} size={14} />
            <Text fontWeight="700" fontSize="16px" color="text">
              {info?.displayName ?? selection.user}
            </Text>
          </Flex>
          {latestBadges.length > 0 && (
            <Flex gap="4px">
              {latestBadges.map((b) => (
                <BadgeChip
                  key={`${b.setId}:${b.id}`}
                  platform={selection.platform}
                  badge={b}
                  accent={color}
                />
              ))}
            </Flex>
          )}
        </Flex>

        {selection.platform === "twitch" ? (
          loading ? (
            <Text fontSize="12px" color="faint" textAlign="center" mb="16px">
              Loading…
            </Text>
          ) : info ? (
            <Flex direction="column" gap="6px" mb="16px" fontSize="12px" color="muted">
              <Text>@{info.login}</Text>
              <Text>Joined Twitch {formatJoinDate(info.createdAt)}</Text>
              {info.broadcasterType && <Text textTransform="capitalize">{info.broadcasterType}</Text>}
              <chakra.a
                href={`https://twitch.tv/${info.login}`}
                target="_blank"
                rel="noopener noreferrer"
                color={color}
              >
                View channel ↗
              </chakra.a>
            </Flex>
          ) : (
            <Text fontSize="12px" color="faint" textAlign="center" mb="16px">
              Couldn&apos;t load profile info.
            </Text>
          )
        ) : (
          <Text fontSize="12px" color="faint" textAlign="center" mb="16px">
            Kick doesn&apos;t expose a public profile-lookup API — showing what&apos;s
            available from chat.
          </Text>
        )}

        <Box>
          <Text fontFamily="mono" fontSize="9px" letterSpacing="0.1em" color="faint" mb="6px">
            RECENT MESSAGES
          </Text>
          {recent.length === 0 ? (
            <Text fontSize="12px" color="faint">
              No messages from them yet this session.
            </Text>
          ) : (
            <Flex direction="column" gap="4px">
              {recent.map((m) => (
                <Text key={m.id} fontSize="12px" color="text">
                  {m.text}
                </Text>
              ))}
            </Flex>
          )}
        </Box>
      </Box>
    </Flex>
  );
}
