const HELIX = "https://api.twitch.tv/helix";

interface HelixEmote {
  id: string;
  name: string;
  emote_type: string;
  format: string[];
}

export interface TwitchChannelEmote {
  code: string;
  url: string;
  locked: boolean;
}

export async function getTwitchChannelEmotes(
  broadcasterId: string,
  accessToken: string,
  clientId: string,
): Promise<TwitchChannelEmote[]> {
  try {
    const res = await fetch(`${HELIX}/chat/emotes?broadcaster_id=${broadcasterId}`, {
      headers: { Authorization: `Bearer ${accessToken}`, "Client-Id": clientId },
      next: { revalidate: 600 },
    });
    if (!res.ok) return [];
    const json = (await res.json()) as { data?: HelixEmote[] };
    return (json.data ?? []).map((e) => {
      const animated = e.format.includes("animated");
      return {
        code: e.name,
        url: `https://static-cdn.jtvnw.net/emoticons/v2/${e.id}/${animated ? "animated" : "static"}/dark/2.0`,
        locked: e.emote_type === "subscriptions" || e.emote_type === "bitstier",
      };
    });
  } catch {
    return [];
  }
}
