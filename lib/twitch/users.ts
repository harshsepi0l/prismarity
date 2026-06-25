import type { User } from "@/lib/auth/types";
import { getValidAccessToken } from "./channels";

const HELIX = "https://api.twitch.tv/helix";

export interface TwitchUserInfo {
  id: string;
  login: string;
  displayName: string;
  profileImageUrl: string;
  createdAt: string;
  broadcasterType: string; // "partner" | "affiliate" | ""
}

// Public profile info for the click-to-view user card — no special scope,
// works for any user id.
export async function getUserInfo(user: User, twitchUserId: string): Promise<TwitchUserInfo | null> {
  const token = await getValidAccessToken(user);
  if (!token) return null;

  try {
    const res = await fetch(`${HELIX}/users?id=${twitchUserId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Client-Id": process.env.TWITCH_CLIENT_ID ?? "",
      },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      data?: {
        id: string;
        login: string;
        display_name: string;
        profile_image_url: string;
        created_at: string;
        broadcaster_type: string;
      }[];
    };
    const u = json.data?.[0];
    if (!u) return null;
    return {
      id: u.id,
      login: u.login,
      displayName: u.display_name,
      profileImageUrl: u.profile_image_url,
      createdAt: u.created_at,
      broadcasterType: u.broadcaster_type,
    };
  } catch (e) {
    console.error("[twitch] user info error:", e instanceof Error ? e.message : e);
    return null;
  }
}
