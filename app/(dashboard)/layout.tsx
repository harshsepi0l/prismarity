import { Flex } from "@chakra-ui/react";
import { LayoutProvider } from "./useLayout";
import { SessionProvider } from "./useSession";
import { ChatProvider } from "./useChat";
import { EmoteProvider } from "./useEmotes";
import { TopBar } from "./components/TopBar";
import { NavRail } from "./components/NavRail";
import { getCurrentUser } from "@/lib/auth/session";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Only a safe subset (display name) is passed to the client — never tokens.
  const user = await getCurrentUser();
  const twitch = user?.connections.find((c) => c.platform === "twitch");
  const auth = twitch ? { displayName: twitch.displayName } : null;

  return (
    <LayoutProvider>
      <SessionProvider>
        <ChatProvider>
          <EmoteProvider>
            <Flex direction="column" h="100vh" overflow="hidden" bg="#0e1320">
              <TopBar />
              <Flex flex="1" minH="0">
                <NavRail auth={auth} />
                {children}
              </Flex>
            </Flex>
          </EmoteProvider>
        </ChatProvider>
      </SessionProvider>
    </LayoutProvider>
  );
}
