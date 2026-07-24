import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { COOKIE_SECURE } from "@/lib/auth/session";

export const runtime = "nodejs";

const POPUP_COOKIE = "prismarity_auth_popup";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ platform: string }> }
) {
  const { platform } = await params;
  if (platform !== "twitch" && platform !== "kick" && platform !== "youtube") {
    return NextResponse.json({ error: "invalid_platform" }, { status: 400 });
  }

  const lib =
    platform === "twitch"
      ? await import("@/lib/auth/twitch")
      : platform === "kick"
        ? await import("@/lib/auth/kick")
        : await import("@/lib/auth/youtube");

  const popup = new URL(req.url).searchParams.get("popup") === "1";
  const state = randomBytes(16).toString("hex");
  const { verifier, challenge } = lib.makePkce();

  const res = NextResponse.redirect(await lib.getAuthorizeUrl(state, challenge));
  const opts = {
    httpOnly: true,
    // Gated on production — a Secure cookie over http://localhost is dropped,
    // which would break the state/verifier round-trip in local dev. See
    // COOKIE_SECURE in lib/auth/session.
    secure: COOKIE_SECURE,
    sameSite: "lax" as const,
    path: "/",
    maxAge: 600,
  };
  res.cookies.set(lib.STATE_COOKIE, state, opts);
  res.cookies.set(lib.VERIFIER_COOKIE, verifier, opts);
  if (popup) res.cookies.set(POPUP_COOKIE, "1", opts);
  return res;
}
