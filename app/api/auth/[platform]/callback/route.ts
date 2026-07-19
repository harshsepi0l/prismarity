import { NextRequest, NextResponse } from "next/server";
import { attachConnection } from "@/lib/auth/store";
import { getBaseUrl } from "@/lib/settings/store";
import {
  SESSION_COOKIE,
  encodeSession,
  sessionCookieOptions,
} from "@/lib/auth/session";

export const runtime = "nodejs";

const POPUP_COOKIE = "prismarity_auth_popup";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ platform: string }> }
) {
  const { platform } = await params;
  if (platform !== "twitch" && platform !== "kick" && platform !== "youtube") {
    return NextResponse.json({ error: "invalid_platform" }, { status: 400 });
  }

  const url = new URL(req.url);
  const sp = url.searchParams;
  const code = sp.get("code");
  const state = sp.get("state");
  const oauthError = sp.get("error");
  const isPopup = !!req.cookies.get(POPUP_COOKIE)?.value;

  // Public origin for redirects — never req.url, which is the internal
  // container host behind a proxy (Azure) and would leak into Location.
  const base = await getBaseUrl();

  // Narrow to the right lib so TypeScript sees concrete TokenResponse types in each branch.
  const twitchLib = platform === "twitch" ? await import("@/lib/auth/twitch") : null;
  const kickLib = platform === "kick" ? await import("@/lib/auth/kick") : null;
  const youtubeLib = platform === "youtube" ? await import("@/lib/auth/youtube") : null;
  const lib = (twitchLib ?? kickLib ?? youtubeLib)!;

  const cookieState = req.cookies.get(lib.STATE_COOKIE)?.value;
  const verifier = req.cookies.get(lib.VERIFIER_COOKIE)?.value;

  const clearAuthCookies = (res: NextResponse) => {
    res.cookies.delete(lib.STATE_COOKIE);
    res.cookies.delete(lib.VERIFIER_COOKIE);
    res.cookies.delete(POPUP_COOKIE);
  };

  const fail = (reason: string) => {
    console.error(`[auth] ${platform} callback failed: ${reason}`);
    const dest = isPopup
      ? new URL(`/auth/success?error=${encodeURIComponent(reason)}`, base)
      : new URL(`/chat?auth=error&reason=${encodeURIComponent(reason)}`, base);
    const res = NextResponse.redirect(dest);
    clearAuthCookies(res);
    return res;
  };

  if (oauthError) {
    console.error(`[auth] ${platform} error:`, oauthError, sp.get("error_description"));
    return fail(`${platform}_${oauthError}`);
  }
  if (!state || !cookieState || state !== cookieState) return fail("state");
  if (!verifier) return fail("no_verifier");
  if (!code) return fail("no_code");

  // Track which step failed so the redirect's ?reason= is self-diagnosing
  // instead of a single opaque "exchange":
  //   token_exchange -> code→token POST rejected (bad client secret, redirect
  //                     URI mismatch, reused/expired code)
  //   identity       -> token OK but the profile/channel lookup failed — for
  //                     YouTube this is typically a Google account with no
  //                     channel (nothing for mine=true to return)
  //   encrypt        -> tokens fetched but couldn't be sealed (bad/missing
  //                     TOKEN_ENCRYPTION_KEY)
  let step: "token_exchange" | "identity" | "encrypt" | "attach" = "token_exchange";
  try {
    let connection;
    if (twitchLib) {
      const token = await twitchLib.exchangeCode(code, verifier);
      step = "identity";
      const identity = await twitchLib.fetchIdentity(token.access_token);
      step = "encrypt";
      connection = twitchLib.toConnection(token, identity);
    } else if (kickLib) {
      const token = await kickLib.exchangeCode(code, verifier);
      step = "identity";
      const identity = await kickLib.fetchIdentity(token.access_token);
      step = "encrypt";
      connection = kickLib.toConnection(token, identity);
    } else {
      const token = await youtubeLib!.exchangeCode(code, verifier);
      step = "identity";
      const identity = await youtubeLib!.fetchIdentity(token.access_token);
      step = "encrypt";
      connection = youtubeLib!.toConnection(token, identity);
    }
    step = "attach";
    const user = await attachConnection(connection);
    const dest = isPopup
      ? new URL("/auth/success", base)
      : new URL("/chat", base);
    const res = NextResponse.redirect(dest);
    clearAuthCookies(res);
    res.cookies.set(SESSION_COOKIE, encodeSession(user), sessionCookieOptions);
    return res;
  } catch (e) {
    // YouTube "no channel on this account" is common enough to name explicitly.
    const msg = e instanceof Error ? e.message : String(e);
    const reason =
      step === "identity" && platform === "youtube" && /identity missing/.test(msg)
        ? "youtube_no_channel"
        : step;
    console.error(`[auth] ${platform} ${step} error:`, e instanceof Error ? e.stack : e);
    return fail(reason);
  }
}
