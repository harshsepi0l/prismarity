import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import {
  getAuthorizeUrl,
  makePkce,
  STATE_COOKIE,
  VERIFIER_COOKIE,
} from "@/lib/auth/twitch";

export const runtime = "nodejs";

// Short-lived marker so the callback knows to close the popup instead of
// redirecting to /chat.
const POPUP_COOKIE = "prismarity_auth_popup";

export async function GET(req: Request) {
  const popup = new URL(req.url).searchParams.get("popup") === "1";
  const state = randomBytes(16).toString("hex");
  const { verifier, challenge } = makePkce();

  const res = NextResponse.redirect(await getAuthorizeUrl(state, challenge));
  const opts = {
    httpOnly: true,
    secure: true,
    sameSite: "lax" as const,
    path: "/",
    maxAge: 600,
  };
  res.cookies.set(STATE_COOKIE, state, opts);
  res.cookies.set(VERIFIER_COOKIE, verifier, opts);
  if (popup) res.cookies.set(POPUP_COOKIE, "1", opts);
  return res;
}
