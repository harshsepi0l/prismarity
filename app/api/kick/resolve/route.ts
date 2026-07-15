import { NextRequest, NextResponse } from "next/server";
import { fetchKickPublic, fetchKickPublicAuthed } from "@/lib/kick/public";
import { getCurrentUser } from "@/lib/auth/session";
import { getValidKickToken } from "@/lib/kick/client";

export const runtime = "nodejs";
export const revalidate = 60;

export async function GET(req: NextRequest) {
  const slug = new URL(req.url).searchParams.get("slug");
  if (!slug) return NextResponse.json({ exists: false }, { status: 400 });

  // Authenticated path: scans /livestreams for channel_id (= chatroom ID), then
  // falls back to own-channel data. Works for any live channel in the top ~25.
  const user = await getCurrentUser();
  if (user) {
    const token = await getValidKickToken(user);
    if (token) {
      const p = await fetchKickPublicAuthed(slug, token);
      if (p) {
        return NextResponse.json({
          exists: true,
          slug: p.slug,
          chatroomId: p.chatroomId,
          broadcasterUserId: p.broadcasterUserId,
        });
      }
    }
  }

  // Unauthenticated fallback — unofficial v2 endpoint (Cloudflare-blocked server-side
  // on most hosts, but kept for completeness).
  const p = await fetchKickPublic(slug);
  if (!p) return NextResponse.json({ exists: false });

  return NextResponse.json({
    exists: true,
    slug: p.slug,
    chatroomId: p.chatroomId,
    broadcasterUserId: p.broadcasterUserId,
  });
}
