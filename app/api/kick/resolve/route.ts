import { NextRequest, NextResponse } from "next/server";
import { fetchKickPublic } from "@/lib/kick/public";

export const runtime = "nodejs";

// Resolves a Kick slug to the data the client needs to read chat (chatroom id)
// and identify the channel. Public data — no auth required.
export async function GET(req: NextRequest) {
  const slug = new URL(req.url).searchParams.get("slug");
  if (!slug) return NextResponse.json({ exists: false }, { status: 400 });

  const p = await fetchKickPublic(slug);
  if (!p) return NextResponse.json({ exists: false });

  return NextResponse.json({
    exists: true,
    slug: p.slug,
    chatroomId: p.chatroomId,
    broadcasterUserId: p.broadcasterUserId,
  });
}
