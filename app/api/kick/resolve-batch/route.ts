import { NextRequest, NextResponse } from "next/server";
import { fetchKickPublic } from "@/lib/kick/public";

export const runtime = "nodejs";

const MAX = 20;

// Resolves several Kick slugs at once: which exist + the data needed to read
// chat (chatroom id) and identify them. Used to auto-detect Kick counterparts
// for the Twitch follow list. Public data — no auth.
export async function GET(req: NextRequest) {
  const raw = new URL(req.url).searchParams.get("slugs") ?? "";
  const slugs = [
    ...new Set(
      raw
        .split(",")
        .map((s) => s.trim().toLowerCase().replace(/^@/, ""))
        .filter(Boolean)
    ),
  ].slice(0, MAX);

  const entries = await Promise.all(
    slugs.map(async (slug) => {
      const p = await fetchKickPublic(slug);
      return [
        slug,
        p
          ? {
              exists: true,
              slug: p.slug,
              chatroomId: p.chatroomId,
              broadcasterUserId: p.broadcasterUserId,
            }
          : { exists: false, slug, chatroomId: null, broadcasterUserId: null },
      ] as const;
    })
  );

  return NextResponse.json({ results: Object.fromEntries(entries) });
}
