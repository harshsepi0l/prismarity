import { Flex } from "@chakra-ui/react";
import { LayoutProvider } from "./useLayout";
import { SessionProvider } from "./useSession";
import { ChatProvider } from "./useChat";
import { TopBar } from "./components/TopBar";
import { NavRail } from "./components/NavRail";
import { getCurrentUser } from "@/lib/auth/session";
import { getRoleForChannel } from "@/lib/auth/roles";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Derive the session view server-side. Only a safe subset (display name +
  // server-derived role) is passed to the client — never tokens.
  const user = await getCurrentUser();
  const twitch = user?.connections.find((c) => c.platform === "twitch");
  const auth =
    user && twitch
      ? {
          login: twitch.login,
          displayName: twitch.displayName,
          role: await getRoleForChannel(user, twitch.platformUserId),
        }
      : null;

  return (
    <LayoutProvider>
      <SessionProvider>
        <ChatProvider creatorLogin={auth?.login ?? null}>
          <Flex direction="column" h="100vh" overflow="hidden" bg="#0e1320">
            <TopBar />
            <Flex flex="1" minH="0">
              <NavRail auth={auth} />
              {children}
            </Flex>
          </Flex>
        </ChatProvider>
      </SessionProvider>
    </LayoutProvider>
  );
}
