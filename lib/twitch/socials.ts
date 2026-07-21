// A channel's "About" panel social links. Twitch's Helix API doesn't expose
// these, so we use the public GraphQL endpoint with the web client's anonymous
// Client-ID — the same call twitch.tv makes to render the social icons.
const GQL = "https://gql.twitch.tv/gql";
const WEB_CLIENT_ID = "kimne78kx3ncx6brgo4mv6wki5h1ko";

export interface ChannelSocial {
  name: string;
  title: string;
  url: string;
}

interface GqlSocial {
  name?: string;
  title?: string;
  url?: string;
}

export async function getChannelSocials(login: string): Promise<ChannelSocial[]> {
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
    if (!res.ok) return [];
    const json = (await res.json()) as {
      data?: { user?: { channel?: { socialMedias?: GqlSocial[] } | null } | null };
    };
    return (json.data?.user?.channel?.socialMedias ?? [])
      .filter((s): s is Required<GqlSocial> => !!s.url && !!s.title)
      .map((s) => ({ name: s.name, title: s.title, url: s.url }));
  } catch {
    return [];
  }
}

// The channel's YouTube link from its socials, if any (channel URL, not a video).
export function findYouTubeUrl(socials: ChannelSocial[]): string | null {
  const yt = socials.find(
    (s) => /youtube\.com|youtu\.be/i.test(s.url) || /youtube/i.test(s.name)
  );
  return yt?.url ?? null;
}
