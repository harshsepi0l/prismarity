// The current pinned message, read from Twitch via anonymous GQL (see
// lib/twitch/banner.ts). Read-only — pinning/unpinning is a mod action we're
// deliberately not implementing.
export interface PinnedMessage {
  messageId: string;
  text: string;
  user: string | null; // sender display name
  color: string | null; // sender chat color
  pinnedBy: string | null; // who pinned it
  sentAt: number | null; // when the message was sent (epoch ms)
  badges: { setId: string; id: string }[]; // sender's badges (normalized for BadgeChip)
}
