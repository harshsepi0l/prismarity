import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getOwnBroadcast, getOwnLiveChatId, sendLiveChatMessage } from "@/lib/youtube/chat";
import { getInitialLiveChat, getLiveChatPage, type InnertubeConfig } from "@/lib/youtube/innertube";

export const runtime = "nodejs";

// Live-chat read — both own and tuned channels go through InnerTube (no OAuth,
// no Data API quota, reads any public chat, and returns richer payloads: custom-
// emote images + unicode emoji). The official liveChatMessages.list only works
// for your own broadcast AND drops emote images, so we don't use it for reading.
//
// The request identifies the video to read:
//   • videoId present → a TUNED streamer's channel (resolved by the client from
//     Twitch socials → /live scrape). No auth needed.
//   • own=1           → the connected account's OWN broadcast: we resolve its
//     video id server-side (liveBroadcasts.list, cookie-authed).
// The client drives an opaque cursor (InnerTube continuation) and honours
// pollingIntervalMillis.

// InnerTube web config (api key + client version) scraped once, reused across
// polls of any channel. Per warm instance; re-scraped when a cursor arrives cold.
let innertubeCfg: InnertubeConfig | null = null;

export async function GET(req: NextRequest) {
  const params = new URL(req.url).searchParams;
  const cursor = params.get("cursor");

  // Resolve which video to read.
  let videoId = params.get("videoId");
  if (!videoId && params.get("own")) {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ live: false }, { status: 401 });
    const broadcast = await getOwnBroadcast(user);
    if (!broadcast) return NextResponse.json({ live: false });
    videoId = broadcast.videoId;
  }
  if (!videoId) return NextResponse.json({ live: false });

  let config = innertubeCfg;
  let continuation = cursor;
  // First poll (no cursor), or a cold instance that lost the config: (re)scrape
  // the live_chat page for the config + a fresh initial continuation.
  if (!continuation || !config) {
    const init = await getInitialLiveChat(videoId);
    if (!init) return NextResponse.json({ live: false });
    config = init.config;
    innertubeCfg = config;
    continuation = init.continuation;
  }
  const result = await getLiveChatPage(continuation, config);
  // Transient upstream error → tell the client to retry WITHOUT dropping its
  // cursor (distinct from a genuine end-of-chat, which is `live: false`).
  if (result.status === "transient") return NextResponse.json({ retry: true });
  if (result.status === "ended") return NextResponse.json({ live: false });
  const { page } = result;
  return NextResponse.json({
    live: true,
    messages: page.messages,
    cursor: page.continuation,
    pollingIntervalMillis: page.timeoutMs,
  });
}

// Post a chat message. `liveChatId` targets a specific chat (a tuned streamer's
// simulcast); omit it to post to your own active broadcast. Requires the
// force-ssl scope — see sendLiveChatMessage. Cookie-authed, same-origin.
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "not_logged_in" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { liveChatId?: string; message?: string };
  const message = (body.message ?? "").trim();
  if (!message) return NextResponse.json({ ok: false, error: "bad_request" }, { status: 400 });

  const liveChatId = body.liveChatId || (await getOwnLiveChatId(user));
  if (!liveChatId) return NextResponse.json({ ok: false, error: "no_channel" }, { status: 400 });

  const result = await sendLiveChatMessage(user, liveChatId, message);
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
