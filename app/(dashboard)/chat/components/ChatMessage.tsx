import { memo, useMemo } from "react";
import { Box, Flex, Text, chakra } from "@chakra-ui/react";
import type { ChatMessage as ChatMessageType, UserSelection } from "../../types";
import { PlatformIcon, PLATFORM_COLOR } from "../../components/PlatformIcon";
import { useEmotes } from "../../_ctx/emotes";
import { useBadges, resolveBadgeImage } from "../../_ctx/badges";

// "self" messages have no platform brand color — a neutral grey stands in.
const SELF_COLOR = "#8B93A7";

// Hype-notice accents (kept in sync with PinnedBar). Raid/gift/sub rows are
// coloured by the source platform instead, so Twitch reads purple and Kick green.
const HYPE = "#F5A0FF";
const GOLD = "#F5C518";

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
// with its image and highlighting "@mention" tokens. Unicode emoji render
// natively as text.
// Native <img> (not chakra.img) so React never replaces the DOM node on re-render,
// which would restart GIF/animated-WebP animation.
function renderBody(text: string, emotes: Record<string, string>, mentionColor: string) {
  return text.split(/(\s+)/).map((token, i) => {
    const url = emotes[token];
    if (url) {
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
    }
    // Highlight the "@name" run, keeping any trailing punctuation plain.
    const mention = token.match(/^(@[\w-]+)(.*)$/);
    if (mention) {
      return (
        <span key={i}>
          <span style={{ color: mentionColor, fontWeight: 600 }}>{mention[1]}</span>
          {mention[2]}
        </span>
      );
    }
    return <span key={i}>{token}</span>;
  });
}

interface ChatMessageProps {
  message: ChatMessageType;
  onHoverChange?: (hovered: boolean) => void;
  onSelectUser?: (selection: UserSelection) => void;
  // When rendering inside a single-platform pane (split view), show only that
  // platform's display name and icon for self-messages instead of the combined label.
  singlePlatform?: "twitch" | "youtube" | "kick";
}

// memo prevents re-renders of unchanged messages when new ones arrive.
// GIF/animated emotes only restart if their <img> DOM node is unmounted or
// its src changes — memo + stable message object refs ensure neither happens.
export default memo(function ChatMessage({
  message,
  onHoverChange,
  onSelectUser,
  singlePlatform,
}: ChatMessageProps) {
  const emotes = useEmotes();
  const platformColor = message.platform === "self" ? SELF_COLOR : PLATFORM_COLOR[message.platform];
  const nameColor = message.color || platformColor;

  const body = useMemo(
    () =>
      renderBody(
        message.text,
        message.nativeEmotes ? { ...emotes, ...message.nativeEmotes } : emotes,
        platformColor
      ),
    [message.text, message.nativeEmotes, emotes, platformColor]
  );
  // System notice (Hype Train / raid / gifted subs) — a centered event row, not a
  // chatter line. Placed after the hooks above so hook order stays stable.
  if (message.system) {
    const notice = message.system;
    let icon = "🚋";
    let accent: string = HYPE;
    let text = "";
    let sub: string | null = null;
    if (notice.kind === "hype_train") {
      accent = notice.isGolden ? GOLD : HYPE;
      const label = notice.isGolden ? "Golden Kappa Train" : "Hype Train";
      text = notice.event === "start" ? `${label} is rolling` : `${label} reached Level ${notice.level}`;
      if (notice.event === "start" && notice.level > 1) sub = `LVL ${notice.level}`;
    } else {
      accent = message.platform === "kick" ? PLATFORM_COLOR.kick : PLATFORM_COLOR.twitch;
      if (notice.kind === "raid") {
        icon = "🚀";
        text = `${notice.from} raided`;
        sub = `${notice.viewers.toLocaleString()} ${notice.viewers === 1 ? "viewer" : "viewers"}`;
      } else if (notice.kind === "gift_sub") {
        icon = "🎁";
        text = `${notice.gifter} gifted ${notice.count} ${notice.count === 1 ? "sub" : "subs"}`;
      } else {
        icon = "⭐";
        text = notice.months > 1 ? `${notice.user} subscribed · ${notice.months} mo` : `${notice.user} subscribed`;
      }
    }
    return (
      <Flex
        align="center"
        justify="center"
        gap="8px"
        py="8px"
        px="12px"
        borderRadius="8px"
        borderWidth="1px"
        style={{ borderColor: `${accent}55`, background: `${accent}14` }}
      >
        <Text fontSize="14px" flex="none" aria-hidden>
          {icon}
        </Text>
        <Text fontSize="12.5px" fontWeight="700" color={accent}>
          {text}
        </Text>
        {sub && (
          <Text fontFamily="mono" fontSize="10px" fontWeight="700" color={accent} opacity={0.85}>
            {sub}
          </Text>
        )}
      </Flex>
    );
  }

  const tag = PLATFORM_TAG[message.platform] ?? "??";

  // For self-messages in split view: show only the relevant platform's name/icon.
  const selfPlatforms: ("twitch" | "youtube" | "kick")[] =
    message.platform === "self"
      ? singlePlatform && message.platforms?.includes(singlePlatform)
        ? [singlePlatform]
        : (message.platforms ?? []) as ("twitch" | "youtube" | "kick")[]
      : [];
  const displayUser =
    message.platform === "self" && singlePlatform && message.userByPlatform?.[singlePlatform]
      ? message.userByPlatform[singlePlatform]
      : message.user;
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
          // Your sent message — show platform icon(s) for this pane.
          selfPlatforms.length > 0 ? (
            <Flex align="center" gap="4px" alignSelf="center" opacity={0.95}>
              {selfPlatforms.map((p) => (
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
            {displayUser}
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
            {displayUser}
          </chakra.button>
        )}

        <Text ml="auto" fontFamily="mono" fontSize="11px" color="faint">
          {time}
        </Text>
      </Flex>

      {body}
    </Box>
  );
});
