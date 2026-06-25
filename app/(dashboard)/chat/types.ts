export type Platform = "twitch" | "youtube" | "kick";

export type ConnectionStatus = "idle" | "connecting" | "connected" | "error";

export interface ChatMessage {
  id: string;
  platform: Platform | "self";
  user: string;
  text: string;
  color?: string | null;
  timestamp: number;
  demo?: boolean;
  // Twitch native emotes for this message (code -> image URL), parsed from the
  // IRC `emotes` tag. Merged with third-party emotes when rendering.
  nativeEmotes?: Record<string, string>;
}
