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
  demo?: boolean;
  // For a "self" message (one you sent): the platforms it was delivered to, so a
  // single entry can show every platform it went out on (e.g. Twitch + Kick).
  platforms?: Platform[];
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
