import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const revalidate = 3600; // socials change rarely

// Twitch's Helix API doesn't expose a channel's social links, so we use the
// public GraphQL endpoint with the web client's anonymous Client-ID — the same
// call the twitch.tv site makes to render the "About" panel's social icons.
const GQL = "https://gql.twitch.tv/gql";
const WEB_CLIENT_ID = "kimne78kx3ncx6brgo4mv6wki5h1ko";

interface GqlSocial {
  name?: string;
  title?: string;
  url?: string;
}

export async function GET(req: NextRequest) {
  const login = new URL(req.url).searchParams.get("login");
  if (!login) return NextResponse.json({ socials: [] });

  try {
    const res = await fetch(GQL, {
      method: "POST",
      headers: { "Client-ID": WEB_CLIENT_ID, "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({
        operationName: "ChannelSocialMedias",
        variables: { login: login.toLowerCase() },
        query:
          "query ChannelSocialMedias($login: String!) { user(login: $login) { channel { socialMedias { name title url } } } }",
      }),
    });
    if (!res.ok) return NextResponse.json({ socials: [] });

    const json = (await res.json()) as {
      data?: { user?: { channel?: { socialMedias?: GqlSocial[] } | null } | null };
    };
    const socials = (json.data?.user?.channel?.socialMedias ?? [])
      .filter((s): s is Required<GqlSocial> => !!s.url && !!s.title)
      .map((s) => ({ name: s.name, title: s.title, url: s.url }));

    return NextResponse.json({ socials });
  } catch {
    return NextResponse.json({ socials: [] });
  }
}
