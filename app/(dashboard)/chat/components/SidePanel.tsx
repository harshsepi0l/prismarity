"use client";

import { useEffect, useState } from "react";
import { Box, Flex, Text, chakra } from "@chakra-ui/react";
import type { Mode } from "../../useSession";
import type { Platform } from "../types";
import { PlatformIcon } from "../../components/PlatformIcon";
import { useChat } from "../../useChat";

const MOD_STATE_KEY = "prismarity:mod-toggles";

// YouTube and Kick are placeholders until those integrations exist.
const CHANNELS: { name: string; platform: Platform; color: string }[] = [
  { name: "Twitch", platform: "twitch", color: "#A66CFF" },
  { name: "YouTube", platform: "youtube", color: "#FF5C5C" },
  { name: "Kick", platform: "kick", color: "#5BE37D" },
];

const MOD_TOGGLES = [
  { id: "slow", label: "Slow mode", initial: false },
  { id: "followers", label: "Followers only", initial: false },
];

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <Text fontFamily="mono" fontSize="10px" letterSpacing="0.18em" color="faint" mb="14px">
      {children}
    </Text>
  );
}

function Divider() {
  return <Box h="1px" bg="line" my="24px" />;
}

function Toggle({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return (
    <chakra.button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={onClick}
      position="relative"
      display="inline-block"
      flex="none"
      w="38px"
      h="21px"
      borderRadius="full"
      bg={on ? "#5BE37D" : "#232a38"}
      transition="background .15s"
      cursor="pointer"
    >
      <Box
        position="absolute"
        top="2px"
        left={on ? "19px" : "2px"}
        w="17px"
        h="17px"
        borderRadius="full"
        bg={on ? "bg" : "text"}
        transition="left .15s"
      />
    </chakra.button>
  );
}

interface SidePanelProps {
  mode: Mode;
}

export default function SidePanel({ mode }: SidePanelProps) {
  const { activeChannel, messagesPerMin } = useChat();
  const [mods, setMods] = useState<Record<string, boolean>>(
    Object.fromEntries(MOD_TOGGLES.map((t) => [t.id, t.initial]))
  );

  const twitchViewers =
    activeChannel && activeChannel.isLive
      ? activeChannel.viewerCount.toLocaleString()
      : "-";
  // Only Twitch is wired up; YouTube and Kick are placeholders.
  const counts: Record<Platform, string> = {
    twitch: twitchViewers,
    youtube: "-",
    kick: "-",
  };
  // Combined = Twitch only for now (others are "-").
  const combinedViewers = twitchViewers;
  const perMin = activeChannel ? String(messagesPerMin) : "-";

  // Persist the moderation toggles across navigation and reloads.
  useEffect(() => {
    const saved = localStorage.getItem(MOD_STATE_KEY);
    if (!saved) return;
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMods((prev) => ({ ...prev, ...JSON.parse(saved) }));
    } catch {
      /* ignore malformed value */
    }
  }, []);

  function toggle(id: string) {
    setMods((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      localStorage.setItem(MOD_STATE_KEY, JSON.stringify(next));
      return next;
    });
  }

  return (
    <>
      <SectionLabel>CHANNELS</SectionLabel>
      <Flex direction="column" gap="13px">
        {CHANNELS.map((ch) => (
          <Flex key={ch.name} align="center" gap="11px">
            <PlatformIcon platform={ch.platform} color={ch.color} size={16} />
            <Text fontWeight="500" fontSize="14px" color={ch.color}>
              {ch.name}
            </Text>
            <Text ml="auto" fontFamily="mono" fontSize="13px" color="msg">
              {counts[ch.platform]}
            </Text>
          </Flex>
        ))}
      </Flex>

      <Divider />

      <SectionLabel>LIVE STATS</SectionLabel>
      <Flex gap="28px">
        <Box>
          <Text fontFamily="mono" fontSize="26px" fontWeight="600" color="text">
            {perMin}
          </Text>
          <Text fontSize="11px" color="muted" mt="4px">
            messages / min
          </Text>
        </Box>
        <Box>
          <Text fontFamily="mono" fontSize="26px" fontWeight="600" color="text">
            {combinedViewers}
          </Text>
          <Text fontSize="11px" color="muted" mt="4px">
            combined viewers
          </Text>
        </Box>
      </Flex>

      {/* Moderation — available to broadcasters and moderators, hidden for viewers. */}
      {/* TODO: mod permissions will come from the authenticated account once OAuth exists. */}
      {mode !== "viewer" && (
        <>
          <Divider />
          <SectionLabel>MODERATION</SectionLabel>
          <Flex direction="column" gap="16px">
            {MOD_TOGGLES.map(({ id, label }) => (
              <Flex key={id} align="center" gap="12px">
                <Text flex="1" fontSize="14px" color="text">
                  {label}
                </Text>
                <Toggle on={mods[id]} onClick={() => toggle(id)} label={label} />
              </Flex>
            ))}
          </Flex>
          <Text mt="14px" fontSize="12px" color="muted" lineHeight="1.55">
            Applies to Twitch, YouTube and Kick at once.
          </Text>
        </>
      )}
    </>
  );
}
