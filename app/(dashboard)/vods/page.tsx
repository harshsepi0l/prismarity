"use client";

import { useEffect, useState } from "react";
import { Box, Flex, Text, Button, SimpleGrid, Input } from "@chakra-ui/react";
import { SectionLabel, Divider, ScreenHeader, HATCH } from "../components/ui";
import { ResizableSidePanel } from "../components/ResizableSidePanel";
import { ManagementGuard } from "../components/ManagementGuard";
import { useSession } from "../_ctx/session";

const SEARCH_KEY = "prismarity:vods-search";

type Plat = "twitch" | "youtube" | "kick";

const COLOR: Record<Plat, string> = { twitch: "#A66CFF", youtube: "#FF5C5C", kick: "#5BE37D" };
const LABEL: Record<Plat, string> = { twitch: "Twitch", youtube: "YouTube", kick: "Kick" };

interface Vod {
  title: string;
  plat: Plat;
  date: string;
  dur: string;
  size: string;
  expiring?: boolean;
  days?: string;
}

const VODS: Vod[] = [
  { title: "Ranked grind to Diamond", plat: "twitch", date: "Jun 21", dur: "4:12:08", size: "8.4 GB" },
  { title: "Community game night", plat: "youtube", date: "Jun 20", dur: "2:48:33", size: "5.1 GB" },
  { title: "Just chatting + Q&A", plat: "kick", date: "Jun 19", dur: "1:55:10", size: "3.2 GB" },
  { title: "Tournament finals watch party", plat: "twitch", date: "Jun 14", dur: "3:30:00", size: "6.8 GB", expiring: true, days: "2" },
  { title: "Speedrun attempts, any%", plat: "youtube", date: "Jun 13", dur: "2:10:44", size: "4.0 GB", expiring: true, days: "5" },
  { title: "Late night co-op", plat: "kick", date: "Jun 18", dur: "2:02:19", size: "3.6 GB" },
];

const STORAGE = [
  { label: "Twitch", color: "#A66CFF", size: "142 GB", pct: "58%" },
  { label: "YouTube", color: "#FF5C5C", size: "98 GB", pct: "40%" },
  { label: "Kick", color: "#5BE37D", size: "24 GB", pct: "12%" },
];

const COLLECTIONS = [
  { name: "Highlights", count: "12", dim: false },
  { name: "Tournaments", count: "5", dim: false },
  { name: "Just chatting", count: "9", dim: false },
  { name: "Unsorted", count: "3", dim: true },
];

const TAGS = ["ranked", "community", "speedrun", "co-op", "q&a"];

function VodCard({ v }: { v: Vod }) {
  return (
    <Flex direction="column" gap="11px">
      <Flex
        position="relative"
        aspectRatio={16 / 9}
        borderRadius="9px"
        align="center"
        justify="center"
        borderLeftWidth="4px"
        borderColor={COLOR[v.plat]}
        outline={v.expiring ? "1px solid #FF5C5C" : "none"}
        style={{ background: HATCH }}
      >
        <Box
          w="0"
          h="0"
          ml="4px"
          borderLeft="15px solid rgba(232,235,242,0.5)"
          borderTop="9px solid transparent"
          borderBottom="9px solid transparent"
        />
        <Text position="absolute" bottom="8px" right="9px" fontFamily="mono" fontSize="10px" color="muted">
          {v.dur}
        </Text>
        {v.expiring && (
          <Text
            position="absolute"
            top="8px"
            left="12px"
            fontFamily="mono"
            fontSize="9px"
            fontWeight="600"
            letterSpacing="0.06em"
            color="bg"
            bg="#FF5C5C"
            px="7px"
            py="3px"
            borderRadius="4px"
          >
            EXPIRES {v.days}D · NOT SAVED
          </Text>
        )}
      </Flex>
      <Flex direction="column" gap="6px">
        <Text fontWeight="500" fontSize="14px" color="text" lineHeight="1.35">
          {v.title}
        </Text>
        <Flex align="center" gap="8px" fontFamily="mono" fontSize="11px" color="muted">
          <Box as="span" color={COLOR[v.plat]}>
            {LABEL[v.plat]}
          </Box>
          <Box as="span" color="#3A4252">·</Box>
          <span>{v.date}</span>
          <Box as="span" color="#3A4252">·</Box>
          <span>{v.size}</span>
        </Flex>
        {v.expiring && (
          <Button
            mt="2px"
            w="100%"
            bg="transparent"
            borderWidth="1px"
            borderColor="#FF5C5C"
            color="#FF5C5C"
            fontWeight="600"
            fontSize="13px"
            py="8px"
            borderRadius="7px"
            _hover={{ bg: "rgba(255,92,92,0.08)" }}
          >
            Save to archive
          </Button>
        )}
      </Flex>
    </Flex>
  );
}

function StoragePanel() {
  return (
    <>
      <SectionLabel>STORAGE</SectionLabel>
      <Flex align="baseline" gap="7px" mt="12px" mb="18px">
        <Text fontFamily="mono" fontSize="24px" fontWeight="600" color="text">
          264 GB
        </Text>
        <Text fontSize="12px" color="muted">
          of 1 TB
        </Text>
      </Flex>
      <Flex direction="column" gap="16px">
        {STORAGE.map((s) => (
          <Box key={s.label}>
            <Flex justify="space-between" fontSize="13px" mb="7px">
              <Text color={s.color}>{s.label}</Text>
              <Text fontFamily="mono" color="muted">
                {s.size}
              </Text>
            </Flex>
            <Box h="4px" borderRadius="2px" bg="line" overflow="hidden">
              <Box h="100%" w={s.pct} bg={s.color} />
            </Box>
          </Box>
        ))}
      </Flex>

      <Divider />

      <SectionLabel>COLLECTIONS</SectionLabel>
      <Flex direction="column" gap="13px" mt="14px">
        {COLLECTIONS.map((c) => (
          <Flex key={c.name} align="center" gap="11px" fontSize="13px" color={c.dim ? "muted" : "text"}>
            <Box w="13px" h="11px" flex="none" borderWidth="1.5px" borderColor={c.dim ? "#3A4252" : "faint"} borderRadius="2px 3px 3px 3px" />
            <Text flex="1">{c.name}</Text>
            <Text fontFamily="mono" fontSize="11px" color="muted">
              {c.count}
            </Text>
          </Flex>
        ))}
      </Flex>

      <Divider />

      <SectionLabel>TAGS</SectionLabel>
      <Flex flexWrap="wrap" gap="7px" mt="13px">
        {TAGS.map((t) => (
          <Box
            key={t}
            fontFamily="mono"
            fontSize="11px"
            color="muted"
            borderWidth="1px"
            borderColor="fieldLine"
            px="10px"
            py="5px"
            borderRadius="999px"
          >
            {t}
          </Box>
        ))}
      </Flex>
    </>
  );
}

export default function VodsPage() {
  const { activeFilters } = useSession();
  const [search, setSearch] = useState("");

  // Persist the search box so it survives navigation and reloads.
  useEffect(() => {
    const saved = localStorage.getItem(SEARCH_KEY);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (saved) setSearch(saved);
  }, []);

  function onSearchChange(value: string) {
    setSearch(value);
    localStorage.setItem(SEARCH_KEY, value);
  }

  const visible = VODS.filter((v) => activeFilters.has(v.plat));
  const expiringCount = visible.filter((v) => v.expiring).length;

  return (
    <ManagementGuard>
      <Flex as="main" flex="1" minW="0">
        <Box as="section" flex="1" minW="0" overflowY="auto" px="32px" pt="28px" pb="36px">
        <ScreenHeader title="VOD library" subtitle="Your owned archive of saved broadcasts." />

        <Flex align="center" gap="10px" mb="18px">
          <Flex
            flex="1"
            align="center"
            gap="10px"
            bg="field"
            borderWidth="1px"
            borderColor="fieldLine"
            borderRadius="9px"
            px="14px"
            py="2px"
          >
            <Box w="13px" h="13px" flex="none" borderWidth="1.8px" borderColor="faint" borderRadius="full" />
            <Input
              variant="flushed"
              border="none"
              px="0"
              fontSize="14px"
              color="text"
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search titles, tags, collections…"
              _placeholder={{ color: "muted" }}
              _focusVisible={{ outline: "none", boxShadow: "none" }}
            />
          </Flex>
        </Flex>

        {expiringCount > 0 && (
          <Flex
            align="center"
            gap="14px"
            px="16px"
            py="14px"
            borderWidth="1px"
            borderColor="rgba(255,92,92,0.4)"
            bg="rgba(255,92,92,0.06)"
            borderRadius="10px"
            mb="24px"
          >
            <Box w="9px" h="9px" flex="none" borderRadius="full" bg="#FF5C5C" animation="pris-pulse 1.4s ease-in-out infinite" />
            <Box flex="1">
              <Text fontWeight="600" fontSize="14px" color="#FF5C5C">
                {expiringCount} broadcast{expiringCount > 1 ? "s" : ""} expire within 7 days and aren&apos;t saved yet
              </Text>
              <Text fontSize="12px" color="muted" mt="2px">
                Source platforms delete these soon. Save them to your owned archive.
              </Text>
            </Box>
            <Button flex="none" bg="#FF5C5C" color="bg" fontWeight="600" fontSize="13px" px="16px" py="9px" borderRadius="7px" _hover={{ bg: "#ff7070" }}>
              Save all now
            </Button>
          </Flex>
        )}

        <SimpleGrid minChildWidth="236px" gap="20px">
          {visible.map((v) => (
            <VodCard key={v.title} v={v} />
          ))}
        </SimpleGrid>
      </Box>

        <ResizableSidePanel>
          <StoragePanel />
        </ResizableSidePanel>
      </Flex>
    </ManagementGuard>
  );
}
