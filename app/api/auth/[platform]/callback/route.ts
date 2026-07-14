import { NextRequest, NextResponse } from "next/server";
import { attachConnection } from "@/lib/auth/store";
import {
  SESSION_COOKIE,
  sessionCookieValue,
  sessionCookieOptions,
  getCurrentUser,
} from "@/lib/auth/session";

export const runtime = "nodejs";

const POPUP_COOKIE = "prismarity_auth_popup";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ platform: string }> }
) {
  const { platform } = await params;
  if (platform !== "twitch" && platform !== "kick") {
    return NextResponse.json({ error: "invalid_platform" }, { status: 400 });
  }

  const url = new URL(req.url);
  const sp = url.searchParams;
  const code = sp.get("code");
  const state = sp.get("state");
  const oauthError = sp.get("error");
  const isPopup = !!req.cookies.get(POPUP_COOKIE)?.value;

  // Narrow to the right lib so TypeScript sees concrete TokenResponse types in each branch.
  const twitchLib = platform === "twitch" ? await import("@/lib/auth/twitch") : null;
  const kickLib = platform === "kick" ? await import("@/lib/auth/kick") : null;
  const lib = (twitchLib ?? kickLib)!;

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
      ? new URL(`/auth/success?error=${encodeURIComponent(reason)}`, url.origin)
      : new URL(`/chat?auth=error&reason=${encodeURIComponent(reason)}`, url.origin);
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

  try {
    const current = await getCurrentUser();

    let connection;
    if (twitchLib) {
      const token = await twitchLib.exchangeCode(code, verifier);
      const identity = await twitchLib.fetchIdentity(token.access_token);
      connection = twitchLib.toConnection(token, identity);
    } else {
      const token = await kickLib!.exchangeCode(code, verifier);
      const identity = await kickLib!.fetchIdentity(token.access_token);
      connection = kickLib!.toConnection(token, identity);
    }
    const user = await attachConnection(connection, current?.id);
    const dest = isPopup
      ? new URL("/auth/success", url.origin)
      : new URL("/chat", url.origin);
    const res = NextResponse.redirect(dest);
    clearAuthCookies(res);
    res.cookies.set(SESSION_COOKIE, sessionCookieValue(user.id), sessionCookieOptions);
    return res;
  } catch (e) {
    console.error(
      `[auth] ${platform} exchange error:`,
      e instanceof Error ? e.stack : e
    );
    return fail("exchange");
  }
}
