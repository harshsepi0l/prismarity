import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { getAuthorizeUrl, STATE_COOKIE } from "@/lib/auth/twitch";

export const runtime = "nodejs";

export async function GET() {
  // CSRF guard: random state stored in a short-lived httpOnly cookie and echoed
  // back by Twitch on the callback.
  const state = randomBytes(16).toString("hex");
  const res = NextResponse.redirect(getAuthorizeUrl(state));
  res.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 600, // 10 minutes
  });
  return res;
}
