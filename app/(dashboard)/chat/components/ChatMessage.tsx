import { memo } from "react";
import { Box, Flex, Text, chakra } from "@chakra-ui/react";
import type { ChatMessage as ChatMessageType, UserSelection } from "../../types";
import { PlatformIcon } from "../../components/PlatformIcon";
import { useEmotes } from "../../_ctx/emotes";
import { useBadges, resolveBadgeImage } from "../../_ctx/badges";

const PLATFORM_COLOR: Record<string, string> = {
  twitch: "#A66CFF",
  youtube: "#FF5C5C",
  kick: "#5BE37D",
  self: "#8B93A7",
};

const PLATFORM_TAG: Record<string, string> = {
  twitch: "TW",
  youtube: "YT",
  kick: "KK",
  self: "ME",
};

// Short fallback label for badge types with no resolvable art (most Kick
// badges besides subscriber — mod/vip/og/founder have no public image source).
const BADGE_LABEL: Record<string, string> = {
  subscriber: "SUB",
  moderator: "MOD",
  vip: "VIP",
  founder: "FOUNDER",
  og: "OG",
  broadcaster: "HOST",
  staff: "STAFF",
  admin: "ADMIN",
  partner: "PARTNER",
  premium: "PRIME",
  turbo: "TURBO",
  sub_gifter: "GIFTER",
};

export function BadgeChip({
  platform,
  badge,
  accent,
}: {
  platform: ChatMessageType["platform"];
  badge: { setId: string; id: string };
  accent: string;
}) {
  const badgeStore = useBadges();
  if (platform !== "twitch" && platform !== "kick") return null;

  const imageUrl = resolveBadgeImage(badgeStore, platform, badge);
  if (imageUrl) {
    return (
      <chakra.img
        src={imageUrl}
        alt={badge.setId}
        title={badge.setId}
        w="16px"
        h="16px"
        display="inline-block"
        flex="none"
      />
    );
  }

  // Level badges: show the actual level number with a distinct Kick-green style.
  if (badge.setId === "level") {
    return (
      <Text
        fontFamily="mono"
        fontSize="9px"
        fontWeight="700"
        letterSpacing="0.02em"
        color="#5BE37D"
        borderWidth="1px"
        borderColor="#5BE37D44"
        borderRadius="4px"
        px="4px"
        py="1px"
        flex="none"
        bg="#5BE37D11"
        title={`Level ${badge.id}`}
      >
        Lv.{badge.id}
      </Text>
    );
  }

  return (
    <Text
      fontFamily="mono"
      fontSize="9px"
      fontWeight="600"
      letterSpacing="0.04em"
      color={accent}
      borderWidth="1px"
      borderColor={accent}
      borderRadius="4px"
      px="4px"
      py="1px"
      flex="none"
    >
      {BADGE_LABEL[badge.setId] ?? badge.setId.slice(0, 4).toUpperCase()}
    </Text>
  );
}

// Split on whitespace (kept), replacing any token that matches an emote code
// with its image. Unicode emoji render natively as text.
// Native <img> (not chakra.img) so React never replaces the DOM node on re-render,
// which would restart GIF/animated-WebP animation.
function renderBody(text: string, emotes: Record<string, string>) {
  return text.split(/(\s+)/).map((token, i) => {
    const url = emotes[token];
    if (!url) return <span key={i}>{token}</span>;
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        key={i}
        src={url}
        alt={token}
        title={token}
        style={{ display: "inline-block", height: 22, verticalAlign: "middle", margin: "0 1px" }}
      />
    );
  });
}

interface ChatMessageProps {
  message: ChatMessageType;
  onHoverChange?: (hovered: boolean) => void;
  onSelectUser?: (selection: UserSelection) => void;
}

// memo prevents re-renders of unchanged messages when new ones arrive.
// GIF/animated emotes only restart if their <img> DOM node is unmounted or
// its src changes — memo + stable message object refs ensure neither happens.
export default memo(function ChatMessage({
  message,
  onHoverChange,
  onSelectUser,
}: ChatMessageProps) {
  const emotes = useEmotes();
  const platformColor = PLATFORM_COLOR[message.platform] ?? "#8B93A7";
  const nameColor = message.color || platformColor;
  const tag = PLATFORM_TAG[message.platform] ?? "??";
  // "self" / "youtube" have no real chatter identity to look up — only
  // twitch/kick messages get a clickable username. A local const (not a
  // property access) so the narrowed type survives into the onClick closure.
  const clickablePlatform: "twitch" | "kick" | null =
    message.platform === "twitch" || message.platform === "kick" ? message.platform : null;

  const time = new Date(message.timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <Box
      onMouseEnter={() => onHoverChange?.(true)}
      onMouseLeave={() => onHoverChange?.(false)}
      borderLeftWidth="2px"
      borderColor={platformColor}
      pl="14px"
      pr="12px"
      py="7px"
      borderRadius="2px 6px 6px 2px"
      transition="background .12s"
      bg={message.platform === "kick" ? "#2e4d3bff" : "#2e344d"}
      _hover={{
        bg: message.platform === "kick" ? "#2E4A35" : "raised",
      }}
    >
      <Flex align="baseline" gap="9px" mb="2px">
        {message.platform === "self" ? (
          // Your sent message — show every platform it went to as one entry.
          message.platforms && message.platforms.length > 0 ? (
            <Flex align="center" gap="4px" alignSelf="center" opacity={0.95}>
              {message.platforms.map((p) => (
                <PlatformIcon key={p} platform={p} size={13} />
              ))}
            </Flex>
          ) : (
            <Text
              fontFamily="mono"
              fontSize="10px"
              letterSpacing="0.08em"
              color={platformColor}
              opacity={0.85}
            >
              {tag}
            </Text>
          )
        ) : (
          <Box as="span" display="inline-flex" alignSelf="center" opacity={0.9}>
            <PlatformIcon platform={message.platform} color={platformColor} size={13} />
          </Box>
        )}

        {message.badges && message.badges.length > 0 && (
          <Flex align="center" gap="3px" flex="none">
            {message.badges.slice(0, 4).map((b) => (
              <BadgeChip
                key={`${b.setId}:${b.id}`}
                platform={message.platform}
                badge={b}
                accent={platformColor}
              />
            ))}
          </Flex>
        )}

        {clickablePlatform === null ? (
          <Text fontWeight="600" fontSize="14px" color={nameColor}>
            {message.user}
          </Text>
        ) : (
          <chakra.button
            type="button"
            onClick={() =>
              onSelectUser?.({
                platform: clickablePlatform,
                user: message.user,
                userId: message.userId,
              })
            }
            fontWeight="600"
            fontSize="14px"
            color={nameColor}
            cursor="pointer"
            _hover={{ textDecoration: "underline" }}
          >
            {message.user}
          </chakra.button>
        )}

        <Text ml="auto" fontFamily="mono" fontSize="11px" color="faint">
          {time}
        </Text>
      </Flex>

      

        {renderBody(
          message.text,
          message.nativeEmotes ? { ...emotes, ...message.nativeEmotes } : emotes
        )}
    </Box>
  );
});
