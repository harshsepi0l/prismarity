"use client";

import { Flex } from "@chakra-ui/react";
import { useSession, clampMode } from "../useSession";
import { useChat } from "../useChat";
import ChatFeed from "./components/ChatFeed";
import Composer from "./components/Composer";
import SidePanel from "./components/SidePanel";
import { ResizableSidePanel } from "../components/ResizableSidePanel";
import { StreamHeader } from "../components/StreamHeader";

export default function ChatPage() {
  const { mode, activeFilters } = useSession();
  const { messages, activeChannel } = useChat();

  // The side panel's mod tools follow the role-clamped mode for this channel.
  const effectiveMode = clampMode(mode, activeChannel?.role ?? "viewer");

  return (
    <Flex as="main" flex="1" minW="0">
      <Flex direction="column" flex="1" minW="0">
        <StreamHeader />
        <ChatFeed messages={messages} activeFilters={activeFilters} />
        <Composer />
      </Flex>

      <ResizableSidePanel>
        <SidePanel mode={effectiveMode} />
      </ResizableSidePanel>
    </Flex>
  );
}
