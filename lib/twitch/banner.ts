import type { HypeTrain } from "@/app/(dashboard)/types";
import type { PinnedMessage } from "./pins";

// Reads the current pinned message + active Hype Train for ANY channel via
// Twitch's private GraphQL endpoint — the same anonymous web Client-ID call the
// site itself makes (see app/api/twitch/shared-chat). No user auth, no mod role,
// no OAuth scope: these reads aren't integrity-gated. (Writing a pin still needs
// Helix moderator:manage:chat_messages — there's no anonymous GQL mutation.)
const GQL = "https://gql.twitch.tv/gql";
const WEB_CLIENT_ID = "kimne78kx3ncx6brgo4mv6wki5h1ko";

const QUERY = `query BannerState($id: ID!) {
  user(id: $id) {
    id
    channel {
      id
      pinnedChatMessages(first: 1) {
        edges {
          node {
            id
            pinnedBy { login displayName }
            pinnedMessage {
              id
              sentAt
              content { text }
              sender { id login displayName chatColor }
              senderBadges { setID version }
            }
          }
        }
      }
      hypeTrain {
        execution {
          id
          expiresAt
          endedAt
          isGoldenKappaTrain
          progress {
            level { value goal }
            total
            goal
            progression
          }
        }
      }
    }
  }
}`;

interface GqlBanner {
  data?: {
    user?: {
      channel?: {
        pinnedChatMessages?: {
          edges?: {
            node?: {
              id?: string;
              pinnedBy?: { login?: string; displayName?: string } | null;
              pinnedMessage?: {
                id?: string;
                sentAt?: string | null;
                content?: { text?: string } | null;
                sender?: { login?: string; displayName?: string; chatColor?: string | null } | null;
                senderBadges?: ({ setID?: string; version?: string } | null)[] | null;
              } | null;
            } | null;
          }[];
        } | null;
        hypeTrain?: {
          execution?: {
            expiresAt?: string | null;
            endedAt?: string | null;
            isGoldenKappaTrain?: boolean;
            progress?: {
              level?: { value?: number; goal?: number } | null;
              total?: number;
              goal?: number;
              progression?: number;
            } | null;
          } | null;
        } | null;
      } | null;
    } | null;
  };
}

export interface BannerState {
  pin: PinnedMessage | null;
  hypeTrain: HypeTrain | null;
}

export async function fetchBannerState(channelId: string): Promise<BannerState> {
  try {
    const res = await fetch(GQL, {
      method: "POST",
      headers: { "Client-ID": WEB_CLIENT_ID, "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({ operationName: "BannerState", variables: { id: channelId }, query: QUERY }),
    });
    if (!res.ok) return { pin: null, hypeTrain: null };

    const json = (await res.json()) as GqlBanner;
    const channel = json.data?.user?.channel;

    // ── pinned message ──
    const node = channel?.pinnedChatMessages?.edges?.[0]?.node;
    const pm = node?.pinnedMessage;
    const pin: PinnedMessage | null =
      pm?.id
        ? {
            messageId: pm.id,
            text: pm.content?.text ?? "",
            user: pm.sender?.displayName ?? pm.sender?.login ?? null,
            color: pm.sender?.chatColor ?? null,
            pinnedBy: node?.pinnedBy?.displayName ?? node?.pinnedBy?.login ?? null,
            sentAt: pm.sentAt ? Date.parse(pm.sentAt) || null : null,
            badges: (pm.senderBadges ?? [])
              .filter((b): b is { setID: string; version?: string } => !!b?.setID)
              .map((b) => ({ setId: b.setID, id: b.version ?? "1" })),
          }
        : null;

    // ── hype train (active only) ──
    const exec = channel?.hypeTrain?.execution;
    let hypeTrain: HypeTrain | null = null;
    if (exec && !exec.endedAt && exec.progress) {
      const p = exec.progress;
      hypeTrain = {
        level: p.level?.value ?? 1,
        progress: p.progression ?? 0,
        goal: p.goal ?? p.level?.goal ?? 0,
        total: p.total ?? 0,
        isGolden: !!exec.isGoldenKappaTrain,
        expiresAt: exec.expiresAt ? Date.parse(exec.expiresAt) || Date.now() + 300_000 : Date.now() + 300_000,
      };
    }

    return { pin, hypeTrain };
  } catch {
    return { pin: null, hypeTrain: null };
  }
}
