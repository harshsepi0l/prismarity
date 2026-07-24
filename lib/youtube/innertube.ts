import type { YouTubeChatMessage } from "./chat";

// Reading an ARBITRARY channel's live chat. The official Data API
// (liveChatMessages.list) only works for your own broadcast — for anyone else it
// 404s "liveChatNotFound". So we read via YouTube's InnerTube endpoint, the same
// one the live_chat page itself polls: no OAuth, no Data API quota, works for any
// public live chat. Undocumented and scrape-shaped (like the app's Kick/Twitch
// reverse-engineering) — every parse failure degrades to "no messages".

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

// Public web INNERTUBE key — a long-lived constant baked into youtube.com. Used
// as the fallback when we can't scrape a fresher one off the page.
const FALLBACK_API_KEY = "AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8";
const FALLBACK_CLIENT_VERSION = "2.20240101.00.00";

export interface InnertubeConfig {
  apiKey: string;
  clientVersion: string;
}

export interface InnertubeChatPage {
  messages: YouTubeChatMessage[];
  continuation: string | null; // cursor for the next poll; null when chat ended
  timeoutMs: number; // how long the page says to wait before the next poll
}

// Pull the first balanced {...} object literal that follows `marker`. More robust
// than a regex against YouTube's huge, nested ytInitialData blob (which contains
// escaped braces inside strings).
function jsonAfter(body: string, marker: string): unknown | null {
  const at = body.indexOf(marker);
  if (at === -1) return null;
  let i = body.indexOf("{", at);
  if (i === -1) return null;
  const start = i;
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (; i < body.length; i++) {
    const c = body[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === "\\") esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) {
        try {
          return JSON.parse(body.slice(start, i + 1));
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

function firstContinuation(cont: Record<string, { continuation?: string; timeoutMs?: number }> | undefined): {
  continuation: string | null;
  timeoutMs: number;
} {
  const c =
    cont?.invalidationContinuationData ??
    cont?.timedContinuationData ??
    cont?.reloadContinuationData ??
    undefined;
  return { continuation: c?.continuation ?? null, timeoutMs: c?.timeoutMs ?? 5_000 };
}

// Scrape the live_chat page for the InnerTube config + the initial continuation
// token. null when the video isn't a live chat we can read.
export async function getInitialLiveChat(
  videoId: string
): Promise<{ config: InnertubeConfig; continuation: string } | null> {
  try {
    const res = await fetch(`https://www.youtube.com/live_chat?is_popout=1&v=${encodeURIComponent(videoId)}`, {
      headers: { "User-Agent": UA, "Accept-Language": "en-US,en;q=0.9", Cookie: "CONSENT=YES+1" },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const body = await res.text();

    const apiKey = body.match(/"INNERTUBE_API_KEY":"([^"]+)"/)?.[1] ?? FALLBACK_API_KEY;
    const clientVersion =
      body.match(/"INNERTUBE_CONTEXT_CLIENT_VERSION":"([^"]+)"/)?.[1] ??
      body.match(/"clientVersion":"([^"]+)"/)?.[1] ??
      FALLBACK_CLIENT_VERSION;

    const data = jsonAfter(body, "ytInitialData") as
      | { contents?: { liveChatRenderer?: { continuations?: Record<string, { continuation?: string }>[] } };
          continuationContents?: { liveChatContinuation?: { continuations?: Record<string, { continuation?: string }>[] } } }
      | null;
    const lc = data?.contents?.liveChatRenderer ?? data?.continuationContents?.liveChatContinuation;
    const continuation = firstContinuation(lc?.continuations?.[0]).continuation;
    if (!continuation) return null;

    return { config: { apiKey, clientVersion }, continuation };
  } catch {
    return null;
  }
}

interface ChatRun {
  text?: string;
  emoji?: {
    emojiId?: string; // unicode char for standard emoji; a channel/id string for custom
    shortcuts?: string[]; // e.g. [":_AnimPeanut:", ":AnimPeanut:"]
    isCustomEmoji?: boolean;
    image?: { thumbnails?: { url?: string; width?: number }[] };
  };
}
interface AuthorBadge {
  liveChatAuthorBadgeRenderer?: { icon?: { iconType?: string }; customThumbnail?: unknown };
}
interface TextRenderer {
  id?: string;
  message?: { runs?: ChatRun[] };
  authorName?: { simpleText?: string };
  authorExternalChannelId?: string;
  authorBadges?: AuthorBadge[];
  timestampUsec?: string;
}

// Flatten message runs to display text + a custom-emote image map. Text runs are
// kept as-is. Standard emoji become their unicode char (emojiId), so they render
// natively. Custom channel emoji become their ":shortcut:" token (kept whitespace-
// delimited so the feed's word-split tokenizer matches it) mapped to the emote
// image — the same nativeEmotes path Kick/Twitch use.
function flattenRuns(runs: ChatRun[] | undefined): { text: string; nativeEmotes?: Record<string, string> } {
  const emotes: Record<string, string> = {};
  let text = "";
  for (const r of runs ?? []) {
    if (r.text != null) {
      text += r.text;
      continue;
    }
    const e = r.emoji;
    if (!e) continue;
    if (e.isCustomEmoji) {
      const token = e.shortcuts?.[0];
      const thumbs = e.image?.thumbnails ?? [];
      const url = thumbs[thumbs.length - 1]?.url ?? thumbs[0]?.url; // largest first
      if (token && url) {
        emotes[token] = url;
        // Pad so the token is its own whitespace-delimited word for the tokenizer.
        text += `${/\s$/.test(text) || text === "" ? "" : " "}${token} `;
      }
    } else {
      // Standard emoji: emojiId is the unicode character; fall back to shortcut.
      text += e.emojiId ?? e.shortcuts?.[0] ?? "";
    }
  }
  return { text: text.trim(), nativeEmotes: Object.keys(emotes).length ? emotes : undefined };
}

function mapRenderer(r: TextRenderer): YouTubeChatMessage | null {
  if (!r.id) return null;
  const { text, nativeEmotes } = flattenRuns(r.message?.runs);
  if (!text) return null;
  const badgeTypes = (r.authorBadges ?? []).map((b) => b.liveChatAuthorBadgeRenderer?.icon?.iconType);
  const hasCustomBadge = (r.authorBadges ?? []).some((b) => !!b.liveChatAuthorBadgeRenderer?.customThumbnail);
  return {
    id: r.id,
    user: r.authorName?.simpleText ?? "anon",
    userId: r.authorExternalChannelId ?? null,
    text,
    publishedAt: r.timestampUsec ? Math.floor(Number(r.timestampUsec) / 1000) || Date.now() : Date.now(),
    isOwner: badgeTypes.includes("OWNER"),
    isModerator: badgeTypes.includes("MODERATOR"),
    // A custom (image) badge on a live chat is a channel membership badge.
    isMember: hasCustomBadge,
    isVerified: badgeTypes.includes("VERIFIED") || badgeTypes.includes("VERIFIED_ARTIST"),
    nativeEmotes,
  };
}

// One InnerTube poll. Returns the batch of new messages + the next continuation.
// null when the chat is over / the token is dead (caller stops or re-inits).
export async function getLiveChatPage(
  continuation: string,
  config: InnertubeConfig
): Promise<InnertubeChatPage | null> {
  try {
    const res = await fetch(
      `https://www.youtube.com/youtubei/v1/live_chat/get_live_chat?key=${encodeURIComponent(config.apiKey)}&prettyPrint=false`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "User-Agent": UA },
        body: JSON.stringify({
          context: { client: { clientName: "WEB", clientVersion: config.clientVersion } },
          continuation,
        }),
        cache: "no-store",
      }
    );
    if (!res.ok) return null;
    const json = (await res.json()) as {
      continuationContents?: {
        liveChatContinuation?: {
          actions?: { addChatItemAction?: { item?: { liveChatTextMessageRenderer?: TextRenderer } } }[];
          continuations?: Record<string, { continuation?: string; timeoutMs?: number }>[];
        };
      };
    };
    const lc = json.continuationContents?.liveChatContinuation;
    if (!lc) return null; // chat ended — no continuationContents

    const messages: YouTubeChatMessage[] = [];
    for (const a of lc.actions ?? []) {
      const r = a.addChatItemAction?.item?.liveChatTextMessageRenderer;
      if (!r) continue;
      const m = mapRenderer(r);
      if (m) messages.push(m);
    }
    const { continuation: next, timeoutMs } = firstContinuation(lc.continuations?.[0]);
    return { messages, continuation: next, timeoutMs };
  } catch {
    return null;
  }
}
