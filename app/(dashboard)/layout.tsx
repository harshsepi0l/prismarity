import { Flex } from "@chakra-ui/react";
import { LayoutProvider } from "./_ctx/layout";
import { SessionProvider } from "./_ctx/session";
import { ChatProvider } from "./_ctx/chat";
import { ChatPrefsProvider } from "./_ctx/chatPrefs";
import { EmoteProvider } from "./_ctx/emotes";
import { BadgeProvider } from "./_ctx/badges";
import { StatsProvider } from "./_ctx/stats";
import { TopBar } from "./components/TopBar";
import { NavRail } from "./components/NavRail";
import { getCurrentUser } from "@/lib/auth/session";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  const twitch = user?.connections.find((c) => c.platform === "twitch");
  const kick = user?.connections.find((c) => c.platform === "kick");
  const youtube = user?.connections.find((c) => c.platform === "youtube");
  const auth = {
    twitch: twitch ? { displayName: twitch.displayName } : null,
    kick: kick ? { displayName: kick.displayName } : null,
    youtube: youtube ? { displayName: youtube.displayName } : null,
  };
  const connectedPlatforms = user?.connections.map((c) => c.platform) ?? [];

  return (
    <LayoutProvider>
      <SessionProvider connectedPlatforms={connectedPlatforms}>
        <ChatProvider kickSlug={kick?.login ?? null} twitchConnected={!!twitch} youtubeConnected={!!youtube}>
          <EmoteProvider>
            <BadgeProvider>
              <StatsProvider>
                <ChatPrefsProvider>
                  <Flex direction="column" h="100vh" overflow="hidden" bg="bg">
                    <TopBar auth={auth} />
                    <Flex flex="1" minH="0">
                      <NavRail />
                      {children}
                    </Flex>
                  </Flex>
                </ChatPrefsProvider>
              </StatsProvider>
            </BadgeProvider>
          </EmoteProvider>
        </ChatProvider>
      </SessionProvider>
    </LayoutProvider>
  );
}
