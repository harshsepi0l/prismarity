import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import {
  getAuthorizeUrl,
  makePkce,
  STATE_COOKIE,
  VERIFIER_COOKIE,
} from "@/lib/auth/kick";

export const runtime = "nodejs";

export async function GET() {
  // CSRF state + PKCE verifier, both in short-lived httpOnly cookies. The
  // verifier never reaches the browser-visible URL — only its S256 challenge.
  const state = randomBytes(16).toString("hex");
  const { verifier, challenge } = makePkce();

  const res = NextResponse.redirect(getAuthorizeUrl(state, challenge));
  const opts = {
    httpOnly: true,
    secure: true,
    sameSite: "lax" as const,
    path: "/",
    maxAge: 600, // 10 minutes
  };
  res.cookies.set(STATE_COOKIE, state, opts);
  res.cookies.set(VERIFIER_COOKIE, verifier, opts);
  return res;
}
