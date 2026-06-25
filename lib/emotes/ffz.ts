// FrankerFaceZ (FFZ) emotes. Code -> image URL.
const GLOBAL_URL = "https://api.frankerfacez.com/v1/set/global";
const roomUrl = (twitchId: string) =>
  `https://api.frankerfacez.com/v1/room/id/${twitchId}`;

interface FfzEmote {
  name: string;
  urls: Record<string, string>;
}
interface FfzSet {
  emoticons?: FfzEmote[];
}
interface FfzResponse {
  sets?: Record<string, FfzSet>;
}

function pickUrl(urls: Record<string, string>): string | undefined {
  // Prefer 2x, then 4x, then 1x. URLs are protocol-relative.
  const u = urls["2"] ?? urls["4"] ?? urls["1"];
  if (!u) return undefined;
  return u.startsWith("//") ? `https:${u}` : u;
}

function collect(data: FfzResponse, map: Record<string, string>): void {
  for (const set of Object.values(data.sets ?? {})) {
    for (const e of set.emoticons ?? []) {
      const url = pickUrl(e.urls);
      if (url) map[e.name] = url;
    }
  }
}

export async function getFfzEmotes(
  channelId?: string
): Promise<Record<string, string>> {
  const map: Record<string, string> = {};

  try {
    const res = await fetch(GLOBAL_URL, { next: { revalidate: 3600 } });
    if (res.ok) collect((await res.json()) as FfzResponse, map);
  } catch {
    /* ignore */
  }

  if (channelId) {
    try {
      const res = await fetch(roomUrl(channelId), { next: { revalidate: 600 } });
      if (res.ok) collect((await res.json()) as FfzResponse, map);
    } catch {
      /* ignore */
    }
  }

  return map;
}
