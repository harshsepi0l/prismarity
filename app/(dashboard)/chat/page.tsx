"use client";

import { Flex } from "@chakra-ui/react";
import { useSession } from "../useSession";
import { useChat } from "../useChat";
import ChatFeed from "./components/ChatFeed";
import Composer from "./components/Composer";
import SidePanel from "./components/SidePanel";
import { ResizableSidePanel } from "../components/ResizableSidePanel";

export default function ChatPage() {
  const { mode, activeFilters } = useSession();
  const { allMessages } = useChat();

  return (
    <Flex as="main" flex="1" minW="0">
      <Flex direction="column" flex="1" minW="0">
        <ChatFeed messages={allMessages} activeFilters={activeFilters} />

        {/* Everyone can chat; Creator/Moderator additionally get the mod tools
            in the side panel. */}
        <Composer />
      </Flex>

      <ResizableSidePanel>
        <SidePanel mode={mode} />
      </ResizableSidePanel>
    </Flex>
  );
}
