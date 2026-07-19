"use client";

import { useMemo, useState } from "react";
import { Box, Flex, Input, Text, chakra } from "@chakra-ui/react";
import type { EmoteCategory } from "../../../_ctx/emotes";
import type { EmoteSource } from "@/app/api/emotes/route";

type EmoteTab = "all" | EmoteSource;

const TAB_LABEL: Record<EmoteTab, string> = {
  all: "All",
  "7tv": "7TV",
  bttv: "BTTV",
  ffz: "FFZ",
  "twitch-channel": "Channel",
};

function LockBadge() {
  return (
    <Box
      position="absolute"
      bottom="2px"
      right="2px"
      borderRadius="3px"
      px="2px"
      py="1px"
      style={{ background: "rgba(0,0,0,0.65)", lineHeight: 0 }}
    >
      <svg width="8" height="8" viewBox="0 0 24 24" fill="white" aria-hidden>
        <path d="M18 10h-1V7c0-2.76-2.24-5-5-5S7 4.24 7 7v3H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V12c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V7c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v3z" />
      </svg>
    </Box>
  );
}

interface EmotePickerProps {
  open: boolean;
  categories: EmoteCategory[];
  onInsert: (code: string, url: string) => void;
}

type EmoteEntry = { code: string; url: string; locked?: boolean };

// The pop-up emote grid above the composer: a search box, per-source tabs, and
// a wrapped grid of clickable emotes (subscriber-locked ones dimmed + badged).
export default function EmotePicker({ open, categories, onInsert }: EmotePickerProps) {
  const [emoteQuery, setEmoteQuery] = useState("");
  const [activeTab, setActiveTab] = useState<EmoteTab>("all");

  // Only offer tabs for sources that actually have emotes for this channel.
  const availableTabs: EmoteTab[] = useMemo(
    () => ["all", ...categories.filter((c) => c.emotes.length > 0).map((c) => c.source)],
    [categories]
  );

  const filteredEmotes = useMemo((): EmoteEntry[] => {
    const q = emoteQuery.trim().toLowerCase();
    const source: EmoteEntry[] =
      activeTab === "all"
        ? categories.flatMap((c) => c.emotes)
        : (categories.find((c) => c.source === activeTab)?.emotes ?? []);
    const matched = q ? source.filter((e) => e.code.toLowerCase().includes(q)) : source;
    return matched.slice(0, 200);
  }, [categories, activeTab, emoteQuery]);

  if (!open) return null;

  return (
    <Box
      position="absolute"
      bottom="100%"
      left="0"
      right="0"
      mb="8px"
      maxH="280px"
      bg="panel"
      borderWidth="1px"
      borderColor="line"
      borderRadius="10px"
      overflow="hidden"
      display="flex"
      flexDirection="column"
      zIndex={5}
    >
      <Box p="8px" borderBottomWidth="1px" borderColor="line">
        <Input
          value={emoteQuery}
          onChange={(e) => setEmoteQuery(e.target.value)}
          placeholder="Search emotes…"
          h="30px"
          fontSize="12px"
          bg="field"
          borderColor="fieldLine"
          borderRadius="8px"
          color="text"
          _placeholder={{ color: "faint" }}
          _focusVisible={{ borderColor: "muted", boxShadow: "none" }}
        />
      </Box>

      {availableTabs.length > 1 && (
        <Flex px="8px" py="6px" gap="4px" borderBottomWidth="1px" borderColor="line">
          {availableTabs.map((tab) => (
            <chakra.button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              px="8px"
              py="3px"
              borderRadius="6px"
              fontSize="11px"
              fontWeight="600"
              bg={activeTab === tab ? "raised" : "transparent"}
              color={activeTab === tab ? "text" : "faint"}
              cursor="pointer"
              transition="background .12s, color .12s"
              _hover={{ color: "text" }}
            >
              {TAB_LABEL[tab]}
            </chakra.button>
          ))}
        </Flex>
      )}

      <Flex p="8px" gap="2px" wrap="wrap" overflowY="auto" alignContent="flex-start">
        {filteredEmotes.length === 0 ? (
          <Text fontSize="12px" color="faint" p="8px">
            No emotes
          </Text>
        ) : (
          filteredEmotes.map(({ code, url, locked }) => (
            <chakra.button
              key={code}
              type="button"
              onClick={() => { if (!locked) onInsert(code, url); }}
              title={locked ? `${code} (Subscribers only — cannot send)` : code}
              p="4px"
              borderRadius="6px"
              cursor={locked ? "not-allowed" : "pointer"}
              opacity={locked ? 0.45 : 1}
              transition="background .1s, opacity .1s"
              _hover={{ bg: locked ? "transparent" : "raised" }}
              position="relative"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt={code} style={{ display: "block", height: 26 }} />
              {locked && <LockBadge />}
            </chakra.button>
          ))
        )}
      </Flex>
    </Box>
  );
}
