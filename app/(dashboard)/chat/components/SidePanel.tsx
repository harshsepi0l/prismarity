"use client";

import { useEffect, useState } from "react";
import { Box, Flex, Text, SimpleGrid, chakra } from "@chakra-ui/react";
import type { Mode } from "../../useSession";
import { useStats, formatUptime, type PlatformLive } from "../../useStats";
import { PlatformIcon, PLATFORM_COLOR } from "../../components/PlatformIcon";

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

// One connected platform's row. Dims when toggled out of the combined roll-up.
function PlatformRow({ p, showSubs }: { p: PlatformLive; showSubs: boolean }) {
  const color = PLATFORM_COLOR[p.platform];
  const meta: string[] = [];
  if (showSubs && p.subs != null) meta.push(`${p.subs.toLocaleString()} subs`);
  if (p.followers != null) meta.push(`${p.followers.toLocaleString()} followers`);
  if (p.peakViewers > 0) meta.push(`peak ${p.peakViewers.toLocaleString()}`);
  if (p.isLive && p.uptimeMs != null) meta.push(formatUptime(p.uptimeMs));

  return (
    <Box
      borderWidth="1px"
      borderColor="line"
      bg="raised"
      borderRadius="8px"
      px="12px"
      py="11px"
      opacity={p.included ? 1 : 0.4}
      transition="opacity .15s"
    >
      <Flex align="center" gap="9px">
        <PlatformIcon platform={p.platform} color={color} size={15} />
        <Text flex="1" minW="0" fontSize="13px" fontWeight="500" color="text" truncate>
          {p.channelName}
        </Text>
        {p.isLive ? (
          <Flex align="center" gap="6px" flex="none">
            <Box w="6px" h="6px" borderRadius="full" bg="#FF5C5C" />
            <Text fontFamily="mono" fontSize="13px" fontWeight="600" color="text">
              {p.viewers.toLocaleString()}
            </Text>
          </Flex>
        ) : (
          <Text fontFamily="mono" fontSize="10px" color="faint" flex="none">
            offline
          </Text>
        )}
      </Flex>
      {meta.length > 0 && (
        <Text fontFamily="mono" fontSize="10px" color="muted" mt="6px">
          {meta.join("  ·  ")}
        </Text>
      )}
    </Box>
  );
}

interface SidePanelProps {
  mode: Mode; // effective (role-clamped) mode for the active channel
}

export default function SidePanel({ mode }: SidePanelProps) {
  const stats = useStats();
  const showMod = mode === "creator" || mode === "moderator";
  // Show subscriber numbers for management roles (the only ones that care).
  const showSubs = showMod;

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

  const viewers = stats.anyLive ? stats.combinedViewers.toLocaleString() : "—";

  return (
    <>
      <SectionLabel>COMBINED</SectionLabel>
      <SimpleGrid columns={2} gap="8px">
        <StatCard label="viewers" value={viewers} accent={stats.anyLive ? "#FF5C5C" : undefined} />
        <StatCard label="messages / min" value={stats.messagesPerMin} />
        <StatCard label="active (5m)" value={stats.activeChatters} />
        {showSubs ? (
          <StatCard label="subscribers" value={fmt(stats.combinedSubs)} accent="#A66CFF" />
        ) : (
          <StatCard label="unique chatters" value={stats.uniqueChatters} />
        )}
      </SimpleGrid>

      <Divider />

      <SectionLabel>PER PLATFORM</SectionLabel>
      {stats.platforms.length === 0 ? (
        <Text fontSize="12px" color="faint">
          Select a channel to see live stats.
        </Text>
      ) : (
        <Flex direction="column" gap="8px">
          {stats.platforms.map((p) => (
            <PlatformRow key={p.platform} p={p} showSubs={showSubs} />
          ))}
        </Flex>
      )}

      {showMod && (
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
        </>
      )}
    </>
  );
}
