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
interface SevenTvResponse {
  emotes?: SevenTvEmote[]; // global shape
  emote_set?: { emotes?: SevenTvEmote[] }; // per-user shape
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

// A large streamer's personal 7TV set can run several MB of raw metadata —
// past Next's fetch-cache 2MB-per-entry ceiling, which silently drops the
// entry and warns "items over 2MB can not be cached" on every request. We
// fetch uncached and keep our own in-memory TTL cache of the trimmed
// code -> URL map instead, which never gets anywhere near that size.
const cache = new Map<string, { map: Record<string, string>; expiresAt: number }>();

async function fetchEmotes(url: string): Promise<Record<string, string>> {
  const map: Record<string, string> = {};
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (res.ok) {
      const data = (await res.json()) as SevenTvResponse;
      for (const e of data.emotes ?? data.emote_set?.emotes ?? []) {
        const url = pickUrl(e);
        if (url) map[e.name] = url;
      }
    }
  } catch {
    /* ignore */
  }
  return map;
}

async function cached(key: string, url: string, ttlMs: number): Promise<Record<string, string>> {
  const hit = cache.get(key);
  if (hit && hit.expiresAt > Date.now()) return hit.map;
  const map = await fetchEmotes(url);
  cache.set(key, { map, expiresAt: Date.now() + ttlMs });
  return map;
}

export async function getSevenTvEmotes(
  channelId?: string
): Promise<Record<string, string>> {
  const [global, channel] = await Promise.all([
    cached("global", GLOBAL_URL, 3_600_000),
    channelId ? cached(`user:${channelId}`, userUrl(channelId), 600_000) : Promise.resolve({}),
  ]);
  return { ...global, ...channel };
}
