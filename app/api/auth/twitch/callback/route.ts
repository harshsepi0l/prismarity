import { NextRequest, NextResponse } from "next/server";
import {
  exchangeCode,
  fetchIdentity,
  toConnection,
  STATE_COOKIE,
} from "@/lib/auth/twitch";
import { upsertConnection } from "@/lib/auth/store";
import {
  SESSION_COOKIE,
  sessionCookieValue,
  sessionCookieOptions,
} from "@/lib/auth/session";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const params = url.searchParams;
  const code = params.get("code");
  const state = params.get("state");
  const oauthError = params.get("error"); // Twitch sends this on denial/misconfig
  const cookieState = req.cookies.get(STATE_COOKIE)?.value;

  // `reason` is a non-sensitive diagnostic (stage that failed) — never tokens.
  const fail = (reason: string) => {
    console.error(`[auth] twitch callback failed: ${reason}`);
    const res = NextResponse.redirect(
      new URL(`/chat?auth=error&reason=${encodeURIComponent(reason)}`, url.origin)
    );
    res.cookies.delete(STATE_COOKIE);
    return res;
  };

  // Twitch rejected the request before issuing a code (e.g. redirect_mismatch,
  // access_denied, invalid client_id).
  if (oauthError) {
    console.error("[auth] twitch error:", oauthError, params.get("error_description"));
    return fail(`twitch_${oauthError}`);
  }

  // CSRF: state must be present and match the cookie.
  if (!state || !cookieState || state !== cookieState) return fail("state");
  if (!code) return fail("no_code");

  try {
    const token = await exchangeCode(code);
    const identity = await fetchIdentity(token.access_token);
    const user = await upsertConnection(toConnection(token, identity));

    const res = NextResponse.redirect(new URL("/chat", url.origin));
    res.cookies.delete(STATE_COOKIE);
    res.cookies.set(SESSION_COOKIE, sessionCookieValue(user.id), sessionCookieOptions);
    return res;
  } catch (e) {
    // Safe to log: these messages carry status codes / config errors, not tokens.
    console.error("[auth] token/identity/store error:", e instanceof Error ? e.message : e);
    return fail("exchange");
  }
}
