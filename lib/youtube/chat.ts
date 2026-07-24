import type { User } from "@/lib/auth/types";
import { getValidYouTubeToken, YOUTUBE_API } from "./client";

// YouTube live-chat plumbing for the Data API side: resolving the connected
// account's own active broadcast, sending messages, and resolving a tuned
// streamer's video to a liveChatId for sending. READING (own AND tuned) goes
// through InnerTube — see lib/youtube/innertube — which returns richer payloads
// (custom-emote images, unicode emoji) and reads any public chat without the
// Data API's own-channel-only restriction.

export interface YouTubeChatMessage {
  id: string;
  user: string;
  userId: string | null;
  text: string;
  publishedAt: number; // epoch ms
  // Author's standing in THIS chat — used for the participant roster / role
  // colouring, not brand-badge image lookup.
  isOwner: boolean;
  isModerator: boolean;
  isMember: boolean; // channel member (sponsor)
  isVerified: boolean;
  // Custom channel emotes in this message (":shortcut:" → image URL), so the feed
  // renders them as images. Standard unicode emoji are already inline in `text`.
  nativeEmotes?: Record<string, string>;
}

export interface OwnBroadcast {
  videoId: string; // the broadcast/watch video id — reads via InnerTube
  liveChatId: string | null; // Data API chat id — used for SEND (readonly for others)
}

// Cache the active broadcast per user so we don't re-run liveBroadcasts.list on
// every poll. A live broadcast's id/chat id are stable, so hold a positive
// result for 60s; but hold a NEGATIVE result (offline, or a transient failure)
// only briefly, so a just-started stream — or recovery from a blip — is picked
// up for read AND send within seconds instead of being wrongly "offline" for a
// full minute. Per warm instance.
const ownBroadcastCache = new Map<string, { info: OwnBroadcast | null; ts: number }>();
const OWN_BROADCAST_TTL_MS = 60_000;
const OWN_BROADCAST_NEGATIVE_TTL_MS = 5_000;

// The user's currently-active broadcast (video id + chat id), or null when
// they're not live (or never enabled live streaming → 403, treated as offline).
// A liveBroadcast's `id` is its watch video id, so it feeds the InnerTube reader
// directly; the liveChatId rides along for sending.
export async function getOwnBroadcast(user: User): Promise<OwnBroadcast | null> {
  const cached = ownBroadcastCache.get(user.id);
  if (cached) {
    const ttl = cached.info ? OWN_BROADCAST_TTL_MS : OWN_BROADCAST_NEGATIVE_TTL_MS;
    if (Date.now() - cached.ts < ttl) return cached.info;
  }

  const token = await getValidYouTubeToken(user);
  if (!token) return null;

  let info: OwnBroadcast | null = null;
  try {
    const res = await fetch(
      `${YOUTUBE_API}/liveBroadcasts?part=snippet&broadcastStatus=active&broadcastType=all&mine=true&maxResults=1`,
      { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" }
    );
    if (res.ok) {
      const json = (await res.json()) as {
        items?: { id?: string; snippet?: { liveChatId?: string } }[];
      };
      const item = json.items?.[0];
      if (item?.id) info = { videoId: item.id, liveChatId: item.snippet?.liveChatId ?? null };
    }
  } catch {
    /* network / 403 → treat as offline */
  }

  ownBroadcastCache.set(user.id, { info, ts: Date.now() });
  return info;
}

// The liveChatId of the user's active broadcast — for SEND only (reads go via
// InnerTube now). Null when offline / chat unavailable.
export async function getOwnLiveChatId(user: User): Promise<string | null> {
  return (await getOwnBroadcast(user))?.liveChatId ?? null;
}

// The active liveChatId for an arbitrary public live video (videos.list ≈ 1 quota
// unit) — how we get the SEND target for a TUNED streamer's chat (their /live
// page gives us the video id; this turns it into the liveChatId to post to).
// Needs a YouTube token; null when not live / chat disabled / not connected.
export async function getLiveChatIdForVideo(user: User, videoId: string): Promise<string | null> {
  const token = await getValidYouTubeToken(user);
  if (!token) return null;
  try {
    const res = await fetch(
      `${YOUTUBE_API}/videos?part=liveStreamingDetails&id=${encodeURIComponent(videoId)}`,
      { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" }
    );
    if (!res.ok) return null;
    const json = (await res.json()) as {
      items?: { liveStreamingDetails?: { activeLiveChatId?: string } }[];
    };
    return json.items?.[0]?.liveStreamingDetails?.activeLiveChatId ?? null;
  } catch {
    return null;
  }
}

// Post a message to a live chat as the connected account. Works for ANY live
// chat the account may post to (your own broadcast OR a streamer you're tuned
// into) — not owner-only. Requires the force-ssl scope (see lib/auth/youtube
// SCOPES); a token minted under the old readonly scope gets 403 until reconnect.
// NOTE the REST path is `liveChat/messages` (with a slash) — NOT the resource
// name `liveChatMessages`, which 404s with an empty body. insert ≈ 50 quota units.
export async function sendLiveChatMessage(
  user: User,
  liveChatId: string,
  text: string
): Promise<{ ok: boolean; error?: string }> {
  const token = await getValidYouTubeToken(user);
  if (!token) return { ok: false, error: "unauthorized" };
  try {
    const res = await fetch(`${YOUTUBE_API}/liveChat/messages?part=snippet`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        snippet: {
          liveChatId,
          type: "textMessageEvent",
          textMessageDetails: { messageText: text },
        },
      }),
    });
    if (res.ok) return { ok: true };
    // 403 here is almost always the missing write scope (readonly token).
    if (res.status === 401 || res.status === 403) return { ok: false, error: "unauthorized" };
    return { ok: false, error: "send_failed" };
  } catch {
    return { ok: false, error: "network" };
  }
}

