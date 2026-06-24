import { Flex } from "@chakra-ui/react";
import { LayoutProvider } from "./useLayout";
import { SessionProvider } from "./useSession";
import { ChatProvider } from "./useChat";
import { TopBar } from "./components/TopBar";
import { NavRail } from "./components/NavRail";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <LayoutProvider>
      <SessionProvider>
        <ChatProvider>
          <Flex direction="column" h="100vh" overflow="hidden" bg="#0e1320">
            <TopBar />
            <Flex flex="1" minH="0">
              <NavRail />
              {children}
            </Flex>
          </Flex>
        </ChatProvider>
      </SessionProvider>
    </LayoutProvider>
  );
}
