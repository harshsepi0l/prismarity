// 7TV (v3) emotes. Code -> image URL.
const GLOBAL_URL = "https://7tv.io/v3/emote-sets/global";
const userUrl = (twitchId: string) => `https://7tv.io/v3/users/twitch/${twitchId}`;

interface SevenTvFile {
  name: string;
}
interface SevenTvEmote {
  name: string;
  data?: {
    host?: {
      url?: string;
      files?: SevenTvFile[];
    };
  };
}

function pickUrl(emote: SevenTvEmote): string | undefined {
  const host = emote.data?.host;
  if (!host?.url) return undefined;
  const base = host.url.startsWith("//") ? `https:${host.url}` : host.url;
  const files = host.files ?? [];
  const file =
    files.find((f) => f.name === "2x.webp")?.name ??
    files.find((f) => f.name.endsWith(".webp"))?.name ??
    files[0]?.name ??
    "2x.webp";
  return `${base}/${file}`;
}

export async function getSevenTvEmotes(
  channelId?: string
): Promise<Record<string, string>> {
  const map: Record<string, string> = {};

  try {
    const res = await fetch(GLOBAL_URL, { next: { revalidate: 3600 } });
    if (res.ok) {
      const data = (await res.json()) as { emotes?: SevenTvEmote[] };
      for (const e of data.emotes ?? []) {
        const url = pickUrl(e);
        if (url) map[e.name] = url;
      }
    }
  } catch {
    /* ignore */
  }

  if (channelId) {
    try {
      const res = await fetch(userUrl(channelId), { next: { revalidate: 600 } });
      if (res.ok) {
        const data = (await res.json()) as {
          emote_set?: { emotes?: SevenTvEmote[] };
        };
        for (const e of data.emote_set?.emotes ?? []) {
          const url = pickUrl(e);
          if (url) map[e.name] = url;
        }
      }
    } catch {
      /* ignore */
    }
  }

  return map;
}
