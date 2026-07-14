"use client";

import { useState } from "react";
import { Flex } from "@chakra-ui/react";
import { useSession, clampMode } from "../_ctx/session";
import { useChat } from "../_ctx/chat";
import ChatFeed from "./components/ChatFeed";
import Composer from "./components/Composer";
import SidePanel from "./components/SidePanel";
import { UserCard } from "./components/UserCard";
import { ResizableSidePanel } from "../components/ResizableSidePanel";
import { StreamHeader } from "../components/StreamHeader";
import type { UserSelection } from "../types";

export default function ChatPage() {
  const { mode, activeFilters } = useSession();
  const { messages, activeRole } = useChat();
  const [selectedUser, setSelectedUser] = useState<UserSelection | null>(null);

  // The side panel's mod tools follow the role-clamped mode for this selection.
  const effectiveMode = clampMode(mode, activeRole);

  return (
    <Flex as="main" flex="1" minW="0">
      <Flex direction="column" flex="1" minW="0">
        <StreamHeader />
        <ChatFeed
          messages={messages}
          activeFilters={activeFilters}
          onSelectUser={setSelectedUser}
        />
        <Composer />
      </Flex>

      <ResizableSidePanel>
        <SidePanel mode={effectiveMode} />
      </ResizableSidePanel>

      <UserCard
        selection={selectedUser}
        onClose={() => setSelectedUser(null)}
        messages={messages}
      />
    </Flex>
  );
}
