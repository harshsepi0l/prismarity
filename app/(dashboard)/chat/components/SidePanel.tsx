"use client";

import { useEffect, useState } from "react";
import { Box, Flex, Text, SimpleGrid, chakra } from "@chakra-ui/react";
import type { Mode } from "../../useSession";
import { useStats, formatUptime, type PlatformLive } from "../../useStats";
import { PlatformIcon, PLATFORM_COLOR } from "../../components/PlatformIcon";
import type { TwitchClip } from "@/lib/twitch/stats";
import type { KickLeader } from "@/lib/kick/public";
import type { CheerLeader, GiftLeader } from "../useTwitchChat";

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

// Small chevron that flips when its section is open.
function Chevron({ open }: { open: boolean }) {
  return (
    <Box
      flex="none"
      color="faint"
      transform={open ? "rotate(180deg)" : "none"}
      transition="transform .15s"
    >
      <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden>
        <path
          d="M1 3 L5 7 L9 3"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </Box>
  );
}

function SubLabel({ children }: { children: React.ReactNode }) {
  return (
    <Text fontFamily="mono" fontSize="9px" letterSpacing="0.1em" color="faint" mb="6px">
      {children}
    </Text>
  );
}

function EmptyNote({ children }: { children: React.ReactNode }) {
  return (
    <Text fontSize="11px" color="faint" mb="2px">
      {children}
    </Text>
  );
}

// One leaderboard entry — rank, platform glyph, name, amount.
function DonorRow({
  rank,
  platform,
  name,
  amount,
  unit,
}: {
  rank: number;
  platform: "twitch" | "kick";
  name: string;
  amount: number;
  unit: string;
}) {
  const color = PLATFORM_COLOR[platform];
  return (
    <Flex align="center" gap="8px" py="3px">
      <Text fontFamily="mono" fontSize="11px" color="faint" w="14px" flex="none">
        {rank}
      </Text>
      <PlatformIcon platform={platform} color={color} size={12} />
      <Text flex="1" minW="0" fontSize="12px" color="text" truncate>
        {name}
      </Text>
      <Text fontFamily="mono" fontSize="12px" fontWeight="600" color={color} flex="none">
        {amount.toLocaleString()} {unit}
      </Text>
    </Flex>
  );
}

// One top clip — rank, title, view count, opens the clip on Twitch.
function ClipRow({ rank, clip }: { rank: number; clip: TwitchClip }) {
  return (
    <chakra.a
      href={clip.url}
      target="_blank"
      rel="noopener noreferrer"
      display="flex"
      alignItems="center"
      gap="8px"
      py="3px"
      _hover={{ color: "text" }}
    >
      <Text fontFamily="mono" fontSize="11px" color="faint" w="14px" flex="none">
        {rank}
      </Text>
      <Text flex="1" minW="0" fontSize="12px" color="text" truncate>
        {clip.title}
      </Text>
      <Text fontFamily="mono" fontSize="11px" color="muted" flex="none">
        {clip.viewCount.toLocaleString()} views
      </Text>
    </chakra.a>
  );
}

// One connected platform's row. Dims when toggled out of the combined roll-up.
// Bits/clips (Twitch) and gift leaderboard (Kick) live in a collapsible
// section nested under their platform, rather than a standalone block.
function PlatformRow({
  p,
  showSubs,
  cheerLeaders,
  giftLeaders,
  clips,
  kickLeaders,
}: {
  p: PlatformLive;
  showSubs: boolean;
  cheerLeaders: CheerLeader[];
  giftLeaders: GiftLeader[];
  clips: TwitchClip[];
  kickLeaders: KickLeader[];
}) {
  const color = PLATFORM_COLOR[p.platform];
  const meta: string[] = [];
  if (showSubs && p.subs != null) meta.push(`${p.subs.toLocaleString()} subs`);
  if (p.followers != null) meta.push(`${p.followers.toLocaleString()} followers`);
  if (p.peakViewers > 0) meta.push(`peak ${p.peakViewers.toLocaleString()}`);
  if (p.isLive && p.uptimeMs != null) meta.push(formatUptime(p.uptimeMs));

  const [open, setOpen] = useState(false);
  const showExtra = p.platform === "twitch" || p.platform === "kick";

  return (
    <Box
      borderWidth="1px"
      borderColor="line"
      bg="raised"
      borderRadius="8px"
      overflow="hidden"
      opacity={p.included ? 1 : 0.4}
      transition="opacity .15s"
    >
      <Box px="12px" py="11px">
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

      {showExtra && (
        <>
          <chakra.button
            type="button"
            onClick={() => setOpen((v) => !v)}
            display="flex"
            alignItems="center"
            justifyContent="space-between"
            w="100%"
            px="12px"
            py="8px"
            borderTopWidth="1px"
            borderColor="line"
            cursor="pointer"
            transition="background .12s"
            _hover={{ bg: "fieldLine" }}
          >
            <Text fontFamily="mono" fontSize="10px" letterSpacing="0.1em" color="muted">
              HIGHLIGHTS
            </Text>
            <Chevron open={open} />
          </chakra.button>

          {open && (
            <Box px="12px" pb="12px" pt="2px">
              {p.platform === "twitch" && (
                <>
                  <Box mb="12px">
                    <SubLabel>TOP CHEERERS (THIS SESSION)</SubLabel>
                    {cheerLeaders.length === 0 ? (
                      <EmptyNote>No bits cheered since you tuned in.</EmptyNote>
                    ) : (
                      cheerLeaders.map((l, i) => (
                        <DonorRow
                          key={l.user}
                          rank={i + 1}
                          platform="twitch"
                          name={l.user}
                          amount={l.bits}
                          unit="bits"
                        />
                      ))
                    )}
                  </Box>
                  <Box mb="12px">
                    <SubLabel>TOP GIFTERS (THIS SESSION)</SubLabel>
                    {giftLeaders.length === 0 ? (
                      <EmptyNote>No sub gifts since you tuned in.</EmptyNote>
                    ) : (
                      giftLeaders.map((l, i) => (
                        <DonorRow
                          key={l.user}
                          rank={i + 1}
                          platform="twitch"
                          name={l.user}
                          amount={l.gifts}
                          unit="gifts"
                        />
                      ))
                    )}
                  </Box>
                  <Box>
                    <SubLabel>TOP CLIPS (PAST WEEK)</SubLabel>
                    {clips.length === 0 ? (
                      <EmptyNote>No clips from the last week.</EmptyNote>
                    ) : (
                      clips.map((c, i) => <ClipRow key={c.id} rank={i + 1} clip={c} />)
                    )}
                  </Box>
                </>
              )}
              {p.platform === "kick" && (
                <Box>
                  <SubLabel>TOP GIFTERS (THIS WEEK)</SubLabel>
                  {kickLeaders.length === 0 ? (
                    <EmptyNote>No gifts this week (or Kick blocked the request).</EmptyNote>
                  ) : (
                    kickLeaders.map((l, i) => (
                      <DonorRow
                        key={l.username}
                        rank={i + 1}
                        platform="kick"
                        name={l.username}
                        amount={l.amount}
                        unit="kicks"
                      />
                    ))
                  )}
                </Box>
              )}
            </Box>
          )}
        </>
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
            <PlatformRow
              key={p.platform}
              p={p}
              showSubs={showSubs}
              cheerLeaders={stats.cheerLeaders}
              giftLeaders={stats.giftLeaders}
              clips={stats.clips}
              kickLeaders={stats.kickLeaders}
            />
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
