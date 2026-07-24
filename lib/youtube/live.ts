// Best-effort "is this YouTube channel live right now" without the Data API
// (which would cost 100 quota units per check via search.list). We fetch the
// channel's `/live` page and look for "isLiveNow":true in the embedded
// ytInitialData — verified to discriminate live vs offline (the bare channel
// page does NOT, and the old hqdefault_live.jpg trick no longer appears).
//
// This is undocumented scraping: it can break if YouTube changes its markup,
// and datacenter IPs may get a consent/bot wall instead of the page. Every
// failure path returns false, so the caller degrades to "not live" gracefully.

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

// Only ever fetch YouTube — this url originates from Twitch socials and flows
// through the client, so treat it as untrusted (SSRF guard).
const ALLOWED_HOSTS = new Set(["youtube.com", "www.youtube.com", "m.youtube.com"]);

// Resolve a channel URL (any of /@handle, /channel/ID, /c/name, /user/name) to
// its `/live` page on www.youtube.com, or null if it isn't a channel URL we can
// check (e.g. youtu.be video links, /watch URLs, non-YouTube hosts).
export function toLiveUrl(raw: string): string | null {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  if (!ALLOWED_HOSTS.has(u.hostname.toLowerCase())) return null;
  let path = u.pathname.replace(/\/+$/, "");
  if (!path || path.startsWith("/watch")) return null; // a video, not a channel
  if (!path.endsWith("/live")) path += "/live";
  return `https://www.youtube.com${path}`;
}

// Live detection from a channel's /live page HTML. Channels signal live in more
// than one way, so a single-string match misses some (e.g. one channel exposes
// "isLiveNow":true, another only "isLive":true). We require BOTH:
//   1. the page canonically resolves to a watch video — i.e. /live actually
//      landed on a stream, not the channel's offline landing page; AND
//   2. a live-now flag ("isLiveNow":true or "isLive":true) — which also keeps a
//      SCHEDULED/upcoming premiere (canonical watch but isLive:false) from
//      reading as live.
// Requiring the canonical /watch also stops a stray "isLive":true in an offline
// page's recommended-videos rail from false-positiving.
export function detectLive(body: string): boolean {
  const canonicalWatch = /<link rel="canonical" href="https:\/\/www\.youtube\.com\/watch\?v=/.test(body);
  const liveFlag = body.includes('"isLiveNow":true') || body.includes('"isLive":true');
  return canonicalWatch && liveFlag;
}

// Concurrent viewer count from a live watch page's embedded data. Live streams
// expose the raw number in `originalViewCount`; we fall back to the human
// "12,345 watching now" string in the viewCount runs. null when neither is
// present (offline pages, or markup we don't recognise).
export function extractConcurrentViewers(body: string): number | null {
  const raw = body.match(/"originalViewCount":"(\d+)"/);
  if (raw) return parseInt(raw[1], 10);
  const watching = body.match(/([\d,]+)\s*watching now/i);
  if (watching) return parseInt(watching[1].replace(/,/g, ""), 10);
  return null;
}

// Public subscriber count from the embedded ytInitialData. YouTube only exposes
// a ROUNDED count (3 sig figs) on the page — same as the Data API for channels
// you don't own — so "1.23M subscribers" → 1_230_000. Matches the contiguous
// "<count> subscribers" label (accessibility/simpleText forms); null when the
// markup doesn't carry it. Best-effort, like the rest of this scraper.
export function extractSubscribers(body: string): number | null {
  const m = body.match(/([\d,.]+)\s*([KMB])?\s*subscribers/i);
  if (!m) return null;
  const n = parseFloat(m[1].replace(/,/g, ""));
  if (!isFinite(n)) return null;
  const mult = m[2] ? { K: 1e3, M: 1e6, B: 1e9 }[m[2].toUpperCase() as "K" | "M" | "B"] : 1;
  return Math.round(n * mult);
}

export interface YouTubeLiveInfo {
  live: boolean;
  viewers: number | null; // concurrent viewers when live and scrapable
  subscribers: number | null; // rounded public subscriber count when scrapable
}

// Small in-memory cache so repeated polls (and multiple viewers) don't refetch
// a ~1.2MB page every time. Best-effort on serverless (per warm instance).
const cache = new Map<string, { info: YouTubeLiveInfo; ts: number }>();
const TTL_MS = 30_000;

// Live status + concurrent viewers for a channel URL (best-effort scrape).
export async function getYouTubeLiveInfo(channelUrl: string): Promise<YouTubeLiveInfo> {
  const liveUrl = toLiveUrl(channelUrl);
  if (!liveUrl) return { live: false, viewers: null, subscribers: null };

  const hit = cache.get(liveUrl);
  if (hit && Date.now() - hit.ts < TTL_MS) return hit.info;

  let info: YouTubeLiveInfo = { live: false, viewers: null, subscribers: null };
  try {
    const res = await fetch(liveUrl, {
      headers: {
        "User-Agent": UA,
        "Accept-Language": "en-US,en;q=0.9",
        // Skip the EU cookie-consent interstitial that can shadow the page.
        Cookie: "CONSENT=YES+1",
      },
      cache: "no-store",
    });
    if (res.ok) {
      const body = await res.text();
      const live = detectLive(body);
      info = {
        live,
        viewers: live ? extractConcurrentViewers(body) : null,
        subscribers: extractSubscribers(body),
      };
    }
  } catch {
    /* network error / blocked → treat as not live */
  }

  cache.set(liveUrl, { info, ts: Date.now() });
  return info;
}

export async function isYouTubeChannelLive(channelUrl: string): Promise<boolean> {
  return (await getYouTubeLiveInfo(channelUrl)).live;
}
