import type { Role, User } from "./types";

// Role is PER CHANNEL and DERIVED — never user-chosen, never trusted from the
// client. A user must never be able to grant themselves creator/moderator tools
// they don't actually hold, so this must always be re-derived server-side from
// Twitch on each request.
export async function getRoleForChannel(
  user: User | null,
  channelId: string
): Promise<Role> {
  if (!user || !channelId) return "viewer";

  // Creator: the user is the broadcaster of this channel (their own id).
  const ownsChannel = user.connections.some(
    (c) => c.platform === "twitch" && c.platformUserId === channelId
  );
  if (ownsChannel) return "creator";

  // TODO: moderator check. Decrypt this user's Twitch access token and call
  // Helix "Get Moderated Channels"
  //   GET https://api.twitch.tv/helix/moderation/channels?user_id=<user>
  // (requires the user:read:moderated_channels scope we request at login).
  // Return "moderator" if channelId is in the result. Stubbed for now.

  return "viewer";
}
