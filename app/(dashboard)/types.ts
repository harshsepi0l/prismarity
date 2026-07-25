import type { Role } from "@/lib/auth/types";

export type Platform = "twitch" | "youtube" | "kick";

export type ConnectionStatus = "idle" | "connecting" | "connected" | "error";

// A unified streamer search result: presence on each platform, matched by name.
export interface SearchResult {
  handle: string;
  displayName: string;
  profileImageUrl: string | null;
  twitch: { id: string; login: string; displayName: string; profileImageUrl: string | null; isLive: boolean; role: Role } | null;
  kick: { slug: string; profileImageUrl: string | null; isLive: boolean; viewers: number; chatroomId: number | null } | null;
}

export interface ChatMessage {
  id: string;
  platform: Platform | "self";
  user: string;
  text: string;
  color?: string | null;
  timestamp: number;
  // Monotonic client-arrival order across ALL platforms — the sole sort key for
  // the merged feed. `timestamp` stays wall-clock (used by stats/labels); `seq`
  // is what keeps Twitch and Kick from reordering into the past. See chat/seq.ts.
  seq?: number;
  demo?: boolean;
  // For a "self" message (one you sent): the platforms it was delivered to, so a
  // single entry can show every platform it went out on (e.g. Twitch + Kick).
  platforms?: Platform[];
  // Per-platform display names for self-messages, used in split view to show
  // just the relevant name per pane instead of the combined "A • B" label.
  userByPlatform?: Partial<Record<Platform, string>>;
  // Twitch native emotes for this message (code -> image URL), parsed from the
  // IRC `emotes` tag. Merged with third-party emotes when rendering.
  nativeEmotes?: Record<string, string>;
  // Platform user id — Twitch's numeric chatter_user_id, or Kick's sender.id.
  // Used to look up full user info for the click-to-view card.
  userId?: string;
  // Badge refs the sender held, normalized across platforms: Twitch's
  // {set_id, id} as-is; Kick's {type, count} as {setId: type, id: String(count)}.
  badges?: { setId: string; id: string }[];
  // When set, this is not a chatter line but a system notice injected into the
  // feed (e.g. a Hype Train starting or levelling up). Rendered as a centered
  // event row and excluded from chatter/rate stats.
  system?: SystemNotice;
}

// A non-chat event surfaced inline in the message feed. The row is coloured by
// the carrier ChatMessage's `platform`, so only the semantic data lives here.
export type SystemNotice =
  | { kind: "hype_train"; event: "start" | "level"; level: number; isGolden: boolean }
  | { kind: "raid"; from: string; viewers: number }
  | { kind: "gift_sub"; gifter: string; count: number }
  | { kind: "sub"; user: string; months: number };

// A chatter picked from the feed (click their name) to look up in UserCard.
export interface UserSelection {
  platform: Platform;
  user: string;
  userId?: string;
}

// ── Pinned / banner bar ──────────────────────────────────────────────────────
// An active Hype Train on the channel (own channel only — see the hype-train
// scope). Updated on begin/progress, cleared on end.
export interface HypeTrain {
  level: number;
  progress: number; // points contributed at the current level
  goal: number; // points needed to reach the next level
  total: number; // total points contributed this train
  isGolden: boolean;
  expiresAt: number; // epoch ms — when the train times out if no more progress
}

// A Hype Train building toward its start ("HYPE TRAIN INCOMING"): contributions
// are landing but the threshold to launch hasn't been hit yet. Surfaced only
// while there's no active train. Reset on channel switch / when it starts or lapses.
export interface HypeTrainApproaching {
  progress: number; // qualifying events landed so far (participants.length)
  goal: number; // events needed to start the train
  isGolden: boolean;
  expiresAt: number; // epoch ms — when the approaching window lapses if no more land
}

// Transient live events surfaced as banners in the cycle bar. `at` is when we
// received it, used to age them out. `platform` attributes the event so the UI
// can brand it (Twitch EventSub vs Kick's Pusher socket).
export type LiveEvent =
  | { id: string; kind: "announcement"; platform: "twitch"; user: string; color: string | null; text: string; at: number }
  | { id: string; kind: "raid"; platform: "twitch" | "kick"; from: string; viewers: number; at: number }
  | { id: string; kind: "gift_sub"; platform: "twitch" | "kick"; gifter: string; count: number; at: number }
  | { id: string; kind: "sub"; platform: "kick"; user: string; months: number; at: number };

// One entry in the cycleable pin/banner bar — the merged view of the real
// mod-pin plus live events.
export type PinItem =
  | {
      kind: "message";
      id: string;
      user: string; // sender display name
      color: string | null;
      text: string;
      pinnedBy: string | null; // who pinned it
      sentAt: number | null; // when the message was sent (epoch ms)
      badges: { setId: string; id: string }[];
    }
  | { kind: "hype_train"; id: string; hype: HypeTrain }
  | { kind: "hype_incoming"; id: string; hype: HypeTrainApproaching }
  | { kind: "announcement"; id: string; platform: "twitch"; user: string; color: string | null; text: string; expiresAt: number }
  | { kind: "raid"; id: string; platform: "twitch" | "kick"; from: string; viewers: number; expiresAt: number }
  | { kind: "gift_sub"; id: string; platform: "twitch" | "kick"; gifter: string; count: number; expiresAt: number }
  | { kind: "sub"; id: string; platform: "kick"; user: string; months: number; expiresAt: number };
