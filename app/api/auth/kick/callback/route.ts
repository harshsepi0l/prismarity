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

const POPUP_COOKIE = "prismarity_auth_popup";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const params = url.searchParams;
  const code = params.get("code");
  const state = params.get("state");
  const oauthError = params.get("error");
  const cookieState = req.cookies.get(STATE_COOKIE)?.value;
  const verifier = req.cookies.get(VERIFIER_COOKIE)?.value;
  const isPopup = !!req.cookies.get(POPUP_COOKIE)?.value;

  const clearAuthCookies = (res: NextResponse) => {
    res.cookies.delete(STATE_COOKIE);
    res.cookies.delete(VERIFIER_COOKIE);
    res.cookies.delete(POPUP_COOKIE);
  };

  const fail = (reason: string) => {
    console.error(`[auth] kick callback failed: ${reason}`);
    const dest = isPopup
      ? new URL(`/auth/success?error=${encodeURIComponent(reason)}`, url.origin)
      : new URL(`/chat?auth=error&reason=${encodeURIComponent(reason)}`, url.origin);
    const res = NextResponse.redirect(dest);
    clearAuthCookies(res);
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
    const current = await getCurrentUser();
    const token = await exchangeCode(code, verifier);
    const identity = await fetchIdentity(token.access_token);
    const user = await attachConnection(toConnection(token, identity), current?.id);

    const dest = isPopup
      ? new URL("/auth/success", url.origin)
      : new URL("/chat", url.origin);
    const res = NextResponse.redirect(dest);
    clearAuthCookies(res);
    res.cookies.set(SESSION_COOKIE, sessionCookieValue(user.id), sessionCookieOptions);
    return res;
  } catch (e) {
    console.error("[auth] kick token/identity/store error:", e instanceof Error ? e.message : e);
    return fail("exchange");
  }
}
