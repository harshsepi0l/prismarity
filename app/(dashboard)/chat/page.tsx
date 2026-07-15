"use client";

import { useState } from "react";
import { Flex } from "@chakra-ui/react";
import { useSession } from "../_ctx/session";
import { useChat } from "../_ctx/chat";
import { useLayout } from "../_ctx/layout";
import ChatFeed from "./components/ChatFeed";
import SplitChatView from "./components/SplitChatView";
import Composer from "./components/Composer";
import SidePanel from "./components/SidePanel";
import { UserCard } from "./components/UserCard";
import { ResizableSidePanel } from "../components/ResizableSidePanel";
import type { Platform, UserSelection } from "../types";

const PLATFORM_ORDER: Platform[] = ["twitch", "kick", "youtube"];

export default function ChatPage() {
  const { activeFilters, connectedPlatforms } = useSession();
  const { messages, activeRole } = useChat();
  const { chatLayout } = useLayout();
  const [selectedUser, setSelectedUser] = useState<UserSelection | null>(null);

  // Ordered list of platforms that are both connected and active in filter.
  const activePlatforms = PLATFORM_ORDER.filter(
    (p) => connectedPlatforms.has(p) && activeFilters.has(p)
  );

  const showSplit = chatLayout === "split" && activePlatforms.length > 1;

  return (
    <Flex as="main" flex="1" minW="0">
      <Flex direction="column" flex="1" minW="0">
        {showSplit ? (
          <SplitChatView
            messages={messages}
            platforms={activePlatforms}
            onSelectUser={setSelectedUser}
          />
        ) : (
          <ChatFeed
            messages={messages}
            activeFilters={activeFilters}
            onSelectUser={setSelectedUser}
          />
        )}
        <Composer />
      </Flex>

      <ResizableSidePanel>
        <SidePanel mode={activeRole} />
      </ResizableSidePanel>

      <UserCard
        selection={selectedUser}
        onClose={() => setSelectedUser(null)}
        messages={messages}
      />
    </Flex>
  );
}
