"use client";

import { Flex } from "@chakra-ui/react";
import { useSession } from "../useSession";
import { useChat } from "../useChat";
import YourChannelBar from "./components/YourChannelBar";
import ViewerBar from "./components/ViewerBar";
import ChannelTabs from "./components/ChannelTabs";
import ChatFeed from "./components/ChatFeed";
import Composer from "./components/Composer";
import SidePanel from "./components/SidePanel";
import { ResizableSidePanel } from "../components/ResizableSidePanel";

export default function ChatPage() {
  const { mode, activeFilters } = useSession();
  const {
    status,
    allMessages,
    creatorChannel,
    saveCreatorChannel,
    viewerChannels,
    activeChannel,
    setActiveChannel,
    addViewerChannel,
    closeChannel,
  } = useChat();

  return (
    <Flex as="main" flex="1" minW="0">
      <Flex direction="column" flex="1" minW="0">
        {mode === "creator" ? (
          <YourChannelBar
            channel={creatorChannel}
            status={status}
            onSave={saveCreatorChannel}
          />
        ) : (
          <>
            <ViewerBar status={status} onAdd={addViewerChannel} />
            <ChannelTabs
              channels={viewerChannels}
              active={activeChannel}
              onSelect={setActiveChannel}
              onClose={closeChannel}
            />
          </>
        )}

        <ChatFeed messages={allMessages} activeFilters={activeFilters} />

        {/* Everyone can chat. Creator/Moderator additionally get the mod tools
            in the side panel; the composer itself is available in every mode. */}
        <Composer litPlatforms={activeFilters} />
      </Flex>

      <ResizableSidePanel>
        <SidePanel mode={mode} />
      </ResizableSidePanel>
    </Flex>
  );
}
