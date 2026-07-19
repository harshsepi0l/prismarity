// Role buckets mirroring Twitch's "Community" panel (Broadcaster / Moderators /
// Community VIPs / Chat Bots / Viewers). We derive them from the badges a
// chatter carried on their messages — real role data for anyone who's spoken —
// plus a known-bot list. Kick uses the same badge setIds (broadcaster/moderator/
// vip), so this works for both platforms.
export type ParticipantRole = "broadcaster" | "moderator" | "vip" | "bot" | "viewer";

// Common chat bots across Twitch + Kick. Twitch's own Community tab lists bots
// separately even when they're modded, so bot detection wins over moderator.
const KNOWN_BOTS = new Set([
  "nightbot", "streamelements", "moobot", "fossabot", "wizebot", "streamlabs",
  "soundalerts", "sery_bot", "commanderroot", "anotherttvviewer", "botisimo",
  "own3d", "blerp", "tangiabot", "pokemoncommunitygame",
  // Kick
  "botrix", "kickbot",
]);

export function isKnownBot(user: string): boolean {
  return KNOWN_BOTS.has(user.toLowerCase());
}

export function participantRole(
  user: string,
  badges: { setId: string }[] | undefined
): ParticipantRole {
  const setIds = new Set((badges ?? []).map((b) => b.setId));
  if (setIds.has("broadcaster")) return "broadcaster";
  if (isKnownBot(user)) return "bot";
  if (setIds.has("moderator")) return "moderator";
  if (setIds.has("vip")) return "vip";
  return "viewer";
}

// Section order + labels for the participants roster.
export const ROLE_SECTIONS: { role: ParticipantRole; label: string }[] = [
  { role: "broadcaster", label: "BROADCASTER" },
  { role: "moderator", label: "MODERATORS" },
  { role: "vip", label: "COMMUNITY VIPS" },
  { role: "bot", label: "CHAT BOTS" },
  { role: "viewer", label: "VIEWERS" },
];
