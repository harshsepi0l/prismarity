"use client";

import { useState } from "react";
import { Flex } from "@chakra-ui/react";
import { useSession } from "../_ctx/session";
import { useChat } from "../_ctx/chat";
import { useLayout } from "../_ctx/layout";
import ChatFeed from "./components/ChatFeed";
import ChatEmptyState from "./components/ChatEmptyState";
import SplitChatView from "./components/SplitChatView";
import ChatReadBar from "./components/ChatReadBar";
import Composer from "./components/Composer";
import SidePanel from "./components/SidePanel";
import { UserCard } from "./components/UserCard";
import { ResizableSidePanel } from "../components/ResizableSidePanel";
import type { Platform, UserSelection } from "../types";

const PLATFORM_ORDER: Platform[] = ["twitch", "kick", "youtube"];

export default function ChatPage() {
  const { activeFilters, connectedPlatforms } = useSession();
  const { messages, activeRole, activeChannel, activeKick, activeKickOnly } = useChat();
  const { chatLayout } = useLayout();
  const [selectedUser, setSelectedUser] = useState<UserSelection | null>(null);

  // Platforms that have a chat for the current channel selection (regardless of
  // whether you're currently watching them) — the read bar toggles among these.
  const availablePlatforms = PLATFORM_ORDER.filter(
    (p) =>
      connectedPlatforms.has(p) &&
      ((p === "twitch" && !!activeChannel) ||
        (p === "kick" && (!!activeKick || !!activeKickOnly)))
  );

  // The subset you're actually watching — drives which columns/messages show.
  const activePlatforms = availablePlatforms.filter((p) => activeFilters.has(p));
  const readFilters = new Set<Platform>(activePlatforms);

  const showSplit = chatLayout === "split" && activePlatforms.length > 1;

  // Not logged into any platform — show the "get started" gate instead of chat.
  if (connectedPlatforms.size === 0) {
    return (
      <Flex as="main" flex="1" minW="0">
        <ChatEmptyState />
      </Flex>
    );
  }

  return (
    <Flex as="main" flex="1" minW="0">
      <Flex direction="column" flex="1" minW="0">
        <ChatReadBar available={availablePlatforms} />
        {showSplit ? (
          <SplitChatView
            messages={messages}
            platforms={activePlatforms}
            onSelectUser={setSelectedUser}
          />
        ) : (
          <ChatFeed
            messages={messages}
            activeFilters={readFilters}
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
