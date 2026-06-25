import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth/session";

// Platform-agnostic logout (not under twitch/) since a Prismarity user may have
// multiple platform connections. Clears the session only.
// TODO: also revoke the token at Twitch (POST https://id.twitch.tv/oauth2/revoke).
export async function POST(req: Request) {
  // 303 so the browser turns the form POST into a GET on /chat.
  const res = NextResponse.redirect(new URL("/chat", req.url), 303);
  res.cookies.delete(SESSION_COOKIE);
  return res;
}
