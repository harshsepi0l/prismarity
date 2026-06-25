import { Box, Flex, Text } from "@chakra-ui/react";
import { SectionLabel, ScreenHeader, HATCH } from "../components/ui";
import { ResizableSidePanel } from "../components/ResizableSidePanel";
import { ManagementGuard } from "../components/ManagementGuard";
import { PlatformIcon } from "../components/PlatformIcon";
import type { Platform } from "../chat/types";

const LEADERS: { rank: string; name: string; points: string; plats: Platform[] }[] = [
  { rank: "01", name: "orbital", points: "48,920", plats: ["twitch", "youtube", "kick"] },
  { rank: "02", name: "pixelwitch", points: "41,305", plats: ["twitch", "youtube"] },
  { rank: "03", name: "neon_drift", points: "38,140", plats: ["kick"] },
  { rank: "04", name: "margaux", points: "29,760", plats: ["youtube", "kick"] },
  { rank: "05", name: "saltmines", points: "24,015", plats: ["twitch"] },
  { rank: "06", name: "byte_runner", points: "19,880", plats: ["kick", "twitch"] },
  { rank: "07", name: "cee_dubs", points: "15,402", plats: ["youtube"] },
];

const ACCRUAL = [
  { label: "Watch time", pct: "72%", note: "1 point per minute watched, across every platform." },
  { label: "Chat activity", pct: "48%", note: "5 points per message, rate-limited to curb spam." },
  { label: "Subs & follows", pct: "90%", note: "500 points per sub, 50 per follow, anywhere." },
];

function TopSupporter() {
  return (
    <Flex
      align="center"
      gap="20px"
      py="20px"
      px="4px"
      borderTopWidth="1px"
      borderBottomWidth="1px"
      borderColor="line"
      mb="26px"
    >
      <Box w="48px" h="48px" borderRadius="10px" flex="none" style={{ background: HATCH }} />
      <Box flex="1">
        <Flex align="center" gap="9px">
          <Text fontWeight="600" fontSize="17px" color="text">
            orbital
          </Text>
          {(["twitch", "youtube", "kick"] as Platform[]).map((pl) => (
            <PlatformIcon key={pl} platform={pl} size={13} />
          ))}
          <Text fontFamily="mono" fontSize="11px" color="faint" ml="3px">
            all three
          </Text>
        </Flex>
        <Text mt="4px" fontSize="13px" color="muted">
          Top supporter this month
        </Text>
      </Box>
      <Box textAlign="right">
        <Text fontFamily="mono" fontSize="30px" fontWeight="600" color="text">
          48,920
        </Text>
        <Text fontSize="11px" color="muted" mt="2px">
          unified points
        </Text>
      </Box>
    </Flex>
  );
}

function Leaderboard() {
  return (
    <>
      <Flex
        align="center"
        gap="14px"
        px="4px"
        pb="12px"
        fontFamily="mono"
        fontSize="10px"
        letterSpacing="0.1em"
        color="faint"
      >
        <Box w="26px">RANK</Box>
        <Box flex="1">VIEWER</Box>
        <Box w="110px">PLATFORMS</Box>
        <Box w="84px" textAlign="right">
          POINTS
        </Box>
      </Flex>
      <Flex direction="column">
        {LEADERS.map((l) => (
          <Flex key={l.rank} align="center" gap="14px" py="13px" px="4px" borderTopWidth="1px" borderColor="line">
            <Text w="26px" fontFamily="mono" fontSize="13px" color="faint">
              {l.rank}
            </Text>
            <Box w="24px" h="24px" borderRadius="6px" flex="none" style={{ background: HATCH }} />
            <Text flex="1" fontWeight="500" fontSize="14px" color="text">
              {l.name}
            </Text>
            <Flex w="110px" gap="6px">
              {l.plats.map((pl) => (
                <PlatformIcon key={pl} platform={pl} size={14} />
              ))}
            </Flex>
            <Text w="84px" textAlign="right" fontFamily="mono" fontSize="15px" fontWeight="600" color="text">
              {l.points}
            </Text>
          </Flex>
        ))}
      </Flex>
    </>
  );
}

function AccrualPanel() {
  return (
    <>
      <SectionLabel>HOW POINTS ACCRUE</SectionLabel>
      <Text mt="8px" mb="22px" fontSize="12px" color="muted" lineHeight="1.55">
        Pulled from every platform into one balance.
      </Text>
      <Flex direction="column" gap="22px">
        {ACCRUAL.map((a) => (
          <Box key={a.label}>
            <Flex align="baseline" justify="space-between" mb="9px">
              <Text fontWeight="500" fontSize="14px" color="text">
                {a.label}
              </Text>
              <Text fontFamily="mono" fontSize="12px" color="muted">
                {a.pct}
              </Text>
            </Flex>
            <Box h="4px" borderRadius="2px" bg="line" overflow="hidden" mb="9px">
              <Box h="100%" w={a.pct} style={{ background: "linear-gradient(90deg,#A66CFF,#5BE37D)" }} />
            </Box>
            <Text fontSize="12px" color="muted" lineHeight="1.55">
              {a.note}
            </Text>
          </Box>
        ))}
      </Flex>
      <Box mt="26px" pt="20px" borderTopWidth="1px" borderColor="line">
        <Text fontSize="12px" color="muted" lineHeight="1.6">
          Follow on Twitch, watch on YouTube — it all builds the{" "}
          <Box as="span" color="text">
            same balance
          </Box>
          .
        </Text>
      </Box>
    </>
  );
}

export default function LoyaltyPage() {
  return (
    <ManagementGuard>
      <Flex as="main" flex="1" minW="0">
        <Box as="section" flex="1" minW="0" overflowY="auto" px="32px" pt="28px" pb="36px">
        <ScreenHeader
          title="Loyalty"
          subtitle="One points balance that follows each viewer across every platform."
        />
        <TopSupporter />
        <Leaderboard />
      </Box>
        <ResizableSidePanel>
          <AccrualPanel />
        </ResizableSidePanel>
      </Flex>
    </ManagementGuard>
  );
}
