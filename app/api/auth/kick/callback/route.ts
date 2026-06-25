import { NextRequest, NextResponse } from "next/server";
import {
  exchangeCode,
  fetchIdentity,
  toConnection,
  STATE_COOKIE,
  VERIFIER_COOKIE,
} from "@/lib/auth/kick";
import { attachConnection } from "@/lib/auth/store";
import {
  SESSION_COOKIE,
  sessionCookieValue,
  sessionCookieOptions,
  getCurrentUser,
} from "@/lib/auth/session";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const params = url.searchParams;
  const code = params.get("code");
  const state = params.get("state");
  const oauthError = params.get("error");
  const cookieState = req.cookies.get(STATE_COOKIE)?.value;
  const verifier = req.cookies.get(VERIFIER_COOKIE)?.value;

  const fail = (reason: string) => {
    console.error(`[auth] kick callback failed: ${reason}`);
    const res = NextResponse.redirect(
      new URL(`/chat?auth=error&reason=${encodeURIComponent(reason)}`, url.origin)
    );
    res.cookies.delete(STATE_COOKIE);
    res.cookies.delete(VERIFIER_COOKIE);
    return res;
  };

  if (oauthError) {
    console.error("[auth] kick error:", oauthError, params.get("error_description"));
    return fail(`kick_${oauthError}`);
  }

  if (!state || !cookieState || state !== cookieState) return fail("state");
  if (!verifier) return fail("verifier");
  if (!code) return fail("no_code");

  try {
    // Link the Kick connection to the current session user when one exists, so
    // it joins the same Prismarity account as an existing Twitch login.
    const current = await getCurrentUser();
    const token = await exchangeCode(code, verifier);
    const identity = await fetchIdentity(token.access_token);
    const user = await attachConnection(toConnection(token, identity), current?.id);

    const res = NextResponse.redirect(new URL("/chat", url.origin));
    res.cookies.delete(STATE_COOKIE);
    res.cookies.delete(VERIFIER_COOKIE);
    res.cookies.set(SESSION_COOKIE, sessionCookieValue(user.id), sessionCookieOptions);
    return res;
  } catch (e) {
    console.error("[auth] kick token/identity/store error:", e instanceof Error ? e.message : e);
    return fail("exchange");
  }
}
