import type { User } from "@/lib/auth/types";
import { helixHeaders } from "./channels";

const HELIX = "https://api.twitch.tv/helix";

export interface TwitchUserInfo {
  id: string;
  login: string;
  displayName: string;
  profileImageUrl: string;
  createdAt: string;
  broadcasterType: string; // "partner" | "affiliate" | ""
  description: string; // channel "About" bio
}

// Look up one or more Twitch users by login name. No special scope required.
export async function getUsersByLogin(
  user: User,
  logins: string[]
): Promise<TwitchUserInfo[]> {
  if (logins.length === 0) return [];
  const headers = await helixHeaders(user);
  if (!headers) return [];
  try {
    const params = logins.map((l) => `login=${encodeURIComponent(l)}`).join("&");
    const res = await fetch(`${HELIX}/users?${params}`, { headers, cache: "no-store" });
    if (!res.ok) return [];
    const json = (await res.json()) as {
      data?: {
        id: string; login: string; display_name: string;
        profile_image_url: string; created_at: string; broadcaster_type: string; description: string;
      }[];
    };
    return (json.data ?? []).map((u) => ({
      id: u.id, login: u.login, displayName: u.display_name,
      profileImageUrl: u.profile_image_url, createdAt: u.created_at, broadcasterType: u.broadcaster_type,
      description: u.description ?? "",
    }));
  } catch {
    return [];
  }
}

// Look up multiple Twitch users by id (up to 100). No special scope required.
export async function getUsersByIds(user: User, ids: string[]): Promise<TwitchUserInfo[]> {
  if (ids.length === 0) return [];
  const headers = await helixHeaders(user);
  if (!headers) return [];
  try {
    const params = ids.slice(0, 100).map((id) => `id=${encodeURIComponent(id)}`).join("&");
    const res = await fetch(`${HELIX}/users?${params}`, { headers, cache: "no-store" });
    if (!res.ok) return [];
    const json = (await res.json()) as {
      data?: {
        id: string; login: string; display_name: string;
        profile_image_url: string; created_at: string; broadcaster_type: string; description: string;
      }[];
    };
    return (json.data ?? []).map((u) => ({
      id: u.id, login: u.login, displayName: u.display_name,
      profileImageUrl: u.profile_image_url, createdAt: u.created_at, broadcasterType: u.broadcaster_type,
      description: u.description ?? "",
    }));
  } catch {
    return [];
  }
}

// Public profile info for the click-to-view user card — no special scope,
// works for any user id.
export async function getUserInfo(user: User, twitchUserId: string): Promise<TwitchUserInfo | null> {
  const headers = await helixHeaders(user);
  if (!headers) return null;

  try {
    const res = await fetch(`${HELIX}/users?id=${twitchUserId}`, {
      headers,
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
        description: string;
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
      description: u.description ?? "",
    };
  } catch (e) {
    console.error("[twitch] user info error:", e instanceof Error ? e.message : e);
    return null;
  }
}
