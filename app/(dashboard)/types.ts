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
}

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

// Transient live events surfaced as banners in the cycle bar. `at` is when we
// received it, used to age them out.
export type LiveEvent =
  | { id: string; kind: "announcement"; user: string; color: string | null; text: string; at: number }
  | { id: string; kind: "raid"; from: string; viewers: number; at: number }
  | { id: string; kind: "gift_sub"; gifter: string; count: number; at: number };

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
  | { kind: "announcement"; id: string; user: string; color: string | null; text: string }
  | { kind: "raid"; id: string; from: string; viewers: number }
  | { kind: "gift_sub"; id: string; gifter: string; count: number };
