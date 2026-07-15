import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

// Twitch "Stream Together" is internally powered by Guest Star collaboration.
// Helix's shared_chat/session only reveals that chats are merged (raw IDs, and
// only with the broadcaster's own auth/scope). The public GraphQL endpoint —
// the same call twitch.tv makes to render the co-stream bar — exposes the full
// roster: who's the host (role LEADER) vs guest (MEMBER), who's active, and
// each participant's individual viewer count. We hit it with the web client's
// anonymous Client-ID, so no user auth is needed.
const GQL = "https://gql.twitch.tv/gql";
const WEB_CLIENT_ID = "kimne78kx3ncx6brgo4mv6wki5h1ko";

const QUERY =
  "query CollabList($id: ID!) { user(id: $id) { id channel { collaboration { id collaborators { role status user { id login displayName profileImageURL(width: 70) roles { isPartner } stream { viewersCount } } } } } } }";

interface GqlCollaborator {
  role?: string;
  status?: string;
  user?: {
    id: string;
    login: string;
    displayName: string;
    profileImageURL?: string | null;
    roles?: { isPartner?: boolean } | null;
    stream?: { viewersCount?: number } | null;
  } | null;
}

export async function GET(req: NextRequest) {
  const channelId = new URL(req.url).searchParams.get("channelId");
  if (!channelId) return NextResponse.json({ active: false, participants: [] });

  try {
    const res = await fetch(GQL, {
      method: "POST",
      headers: { "Client-ID": WEB_CLIENT_ID, "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({
        operationName: "CollabList",
        variables: { id: channelId },
        query: QUERY,
      }),
    });
    if (!res.ok) {
      console.warn("[twitch] collaboration gql failed:", res.status);
      return NextResponse.json({ active: false, participants: [] });
    }

    const json = (await res.json()) as {
      data?: { user?: { channel?: { collaboration?: { collaborators?: GqlCollaborator[] } | null } | null } | null };
    };
    const collaborators = json.data?.user?.channel?.collaboration?.collaborators ?? [];

    const participants = collaborators
      // Only ACTIVE members are actually live in the co-stream right now.
      .filter((c) => c.status === "ACTIVE" && c.user)
      .map((c) => ({
        id: c.user!.id,
        login: c.user!.login,
        displayName: c.user!.displayName,
        profileImageUrl: c.user!.profileImageURL ?? null,
        verified: c.user!.roles?.isPartner ?? false,
        // LEADER = the broadcaster hosting Stream Together; MEMBER = a guest.
        host: c.role === "LEADER",
        viewers: c.user!.stream?.viewersCount ?? null,
      }))
      // Surface the host first regardless of the roster's return order.
      .sort((a, b) => Number(b.host) - Number(a.host));

    return NextResponse.json({
      active: participants.length > 1,
      participants,
    });
  } catch {
    return NextResponse.json({ active: false, participants: [] });
  }
}
