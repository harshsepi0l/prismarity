"use client";

import { useEffect, useState } from "react";
import { Box, Flex, Text, SimpleGrid, chakra } from "@chakra-ui/react";
import type { Mode } from "../../useSession";
import { useStats, formatUptime, type LiveStats } from "../../useStats";

const MOD_STATE_KEY = "prismarity:mod-toggles";

const MOD_TOGGLES = [
  { id: "slow", label: "Slow mode" },
  { id: "followers", label: "Followers only" },
  { id: "emote", label: "Emote only" },
  { id: "subs", label: "Subscribers only" },
];

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <Text fontFamily="mono" fontSize="10px" letterSpacing="0.18em" color="faint" mb="12px">
      {children}
    </Text>
  );
}

function Divider() {
  return <Box h="1px" bg="line" my="22px" />;
}

function StatCard({ label, value, accent }: { label: string; value: React.ReactNode; accent?: string }) {
  return (
    <Box borderWidth="1px" borderColor="line" bg="raised" borderRadius="8px" px="12px" py="10px">
      <Text fontFamily="mono" fontSize="20px" fontWeight="600" lineHeight="1.1" color={accent ?? "text"}>
        {value}
      </Text>
      <Text fontSize="10px" color="muted" mt="4px">
        {label}
      </Text>
    </Box>
  );
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

const fmt = (n: number | null) => (n == null ? "—" : n.toLocaleString());

function TopChatters({ stats }: { stats: LiveStats }) {
  if (stats.topChatters.length === 0) {
    return (
      <Text fontSize="12px" color="faint">
        Quiet so far.
      </Text>
    );
  }
  return (
    <Flex direction="column" gap="8px">
      {stats.topChatters.map((c, i) => (
        <Flex key={c.user} align="center" gap="10px" fontSize="13px">
          <Text fontFamily="mono" fontSize="11px" color="faint" w="14px">
            {i + 1}
          </Text>
          <Text flex="1" color="text" truncate>
            {c.user}
          </Text>
          <Text fontFamily="mono" fontSize="12px" color="muted">
            {c.count}
          </Text>
        </Flex>
      ))}
    </Flex>
  );
}

function TopEmotes({ stats }: { stats: LiveStats }) {
  if (stats.topEmotes.length === 0) {
    return (
      <Text fontSize="12px" color="faint">
        No emotes yet.
      </Text>
    );
  }
  return (
    <Flex wrap="wrap" gap="10px">
      {stats.topEmotes.map((e) => (
        <Flex key={e.code} align="center" gap="6px" title={e.code}>
          <chakra.img src={e.url} alt={e.code} h="24px" />
          <Text fontFamily="mono" fontSize="12px" color="muted">
            {e.count}
          </Text>
        </Flex>
      ))}
    </Flex>
  );
}

interface SidePanelProps {
  mode: Mode; // effective (role-clamped) mode for the active channel
}

export default function SidePanel({ mode }: SidePanelProps) {
  const stats = useStats();
  const [mods, setMods] = useState<Record<string, boolean>>(
    Object.fromEntries(MOD_TOGGLES.map((t) => [t.id, false]))
  );

  useEffect(() => {
    const saved = localStorage.getItem(MOD_STATE_KEY);
    if (!saved) return;
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMods((prev) => ({ ...prev, ...JSON.parse(saved) }));
    } catch {
      /* ignore */
    }
  }, []);

  function toggle(id: string) {
    setMods((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      localStorage.setItem(MOD_STATE_KEY, JSON.stringify(next));
      return next;
    });
  }

  const viewers = stats.isLive ? stats.viewers.toLocaleString() : "—";
  const uptime = stats.isLive ? formatUptime(stats.uptimeMs) : "—";

  // ── Viewer: compact strip ────────────────────────────────
  if (mode === "viewer") {
    return (
      <>
        <SectionLabel>STREAM</SectionLabel>
        <SimpleGrid columns={2} gap="8px">
          <StatCard label="viewers" value={viewers} />
          <StatCard label="uptime" value={uptime} />
          <StatCard label="messages / min" value={stats.messagesPerMin} />
          <StatCard label="active chatters" value={stats.activeChatters} />
        </SimpleGrid>
      </>
    );
  }

  // ── Creator / Moderator: tailored stacks ─────────────────
  const isCreator = mode === "creator";

  return (
    <>
      <SectionLabel>STREAM</SectionLabel>
      <SimpleGrid columns={2} gap="8px">
        <StatCard label="viewers" value={viewers} accent={stats.isLive ? "#FF5C5C" : undefined} />
        <StatCard label="uptime" value={uptime} />
        {isCreator && <StatCard label="peak viewers" value={stats.peakViewers || "—"} />}
        <StatCard label="messages / min" value={stats.messagesPerMin} />
      </SimpleGrid>

      <Divider />

      {isCreator ? (
        <>
          <SectionLabel>GROWTH</SectionLabel>
          <SimpleGrid columns={2} gap="8px">
            <StatCard label="subscribers" value={fmt(stats.subs)} accent="#A66CFF" />
            <StatCard label="followers" value={fmt(stats.followers)} />
          </SimpleGrid>
        </>
      ) : (
        <>
          <SectionLabel>AUDIENCE</SectionLabel>
          <SimpleGrid columns={2} gap="8px">
            <StatCard label="chatters" value={fmt(stats.chatters)} />
            <StatCard label="followers" value={fmt(stats.followers)} />
          </SimpleGrid>
        </>
      )}

      <Divider />

      <SectionLabel>CHAT</SectionLabel>
      <SimpleGrid columns={2} gap="8px" mb="16px">
        <StatCard label="unique chatters" value={stats.uniqueChatters} />
        <StatCard label="active (5m)" value={stats.activeChatters} />
      </SimpleGrid>
      <Text fontFamily="mono" fontSize="9px" letterSpacing="0.16em" color="faint" mb="10px">
        TOP CHATTERS
      </Text>
      <TopChatters stats={stats} />
      <Box mt="16px">
        <Text fontFamily="mono" fontSize="9px" letterSpacing="0.16em" color="faint" mb="10px">
          TOP EMOTES
        </Text>
        <TopEmotes stats={stats} />
      </Box>

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
    </>
  );
}
