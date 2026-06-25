import { Box, Flex, Text, chakra } from "@chakra-ui/react";
import type { ChatMessage as ChatMessageType } from "../types";
import { PlatformIcon } from "../../components/PlatformIcon";
import { useEmotes } from "../../useEmotes";

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

// Split on whitespace (kept), replacing any token that matches an emote code
// with its image. Unicode emoji render natively as text.
function renderBody(text: string, emotes: Record<string, string>) {
  return text.split(/(\s+)/).map((token, i) => {
    const url = emotes[token];
    if (!url) return <span key={i}>{token}</span>;
    return (
      <chakra.img
        key={i}
        src={url}
        alt={token}
        title={token}
        display="inline-block"
        h="22px"
        verticalAlign="middle"
        mx="1px"
      />
    );
  });
}

interface ChatMessageProps {
  message: ChatMessageType;
  onHoverChange?: (hovered: boolean) => void;
}

export default function ChatMessage({
  message,
  onHoverChange,
}: ChatMessageProps) {
  const emotes = useEmotes();
  const platformColor = PLATFORM_COLOR[message.platform] ?? "#8B93A7";
  const nameColor = message.color || platformColor;
  const tag = PLATFORM_TAG[message.platform] ?? "??";

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
      bg="#2e344d"
      _hover={{ bg: "raised" }}
    >
      <Flex align="baseline" gap="9px" mb="2px">
        {message.platform === "self" ? (
          <Text
            fontFamily="mono"
            fontSize="10px"
            letterSpacing="0.08em"
            color={platformColor}
            opacity={0.85}
          >
            {tag}
          </Text>
        ) : (
          <Box as="span" display="inline-flex" alignSelf="center" opacity={0.9}>
            <PlatformIcon platform={message.platform} color={platformColor} size={13} />
          </Box>
        )}

        <Text fontWeight="600" fontSize="14px" color={nameColor}>
          {message.user}
        </Text>

        <Text ml="auto" fontFamily="mono" fontSize="11px" color="faint">
          {time}
        </Text>
      </Flex>

      <Text fontSize="14px" color="msg" lineHeight="1.5">
        {message.demo && (
          <Box
            as="span"
            fontFamily="mono"
            fontSize="9px"
            fontWeight="500"
            textTransform="uppercase"
            color="faint"
            borderWidth="1px"
            borderColor="line"
            borderRadius="4px"
            px="4px"
            py="1px"
            mr="6px"
          >
            demo
          </Box>
        )}

        {renderBody(
          message.text,
          message.nativeEmotes ? { ...emotes, ...message.nativeEmotes } : emotes
        )}
      </Text>
    </Box>
  );
}
