"use client";

import { Box, Flex, chakra } from "@chakra-ui/react";
import { useLayout } from "../_ctx/layout";
import { ResizeHandle } from "./ResizeHandle";

export function ResizableSidePanel({ children }: { children: React.ReactNode }) {
  const { panelWidth, setPanelWidth, isMobile, panelMode, panelOpen, setPanelOpen } = useLayout();

  // Mobile: the docked panel would eat the whole narrow screen, so it becomes an
  // overlay drawer that takes over the chat — same treatment as the NavRail on
  // mobile — opened from the TopBar stats button and dismissed by the backdrop.
  if (isMobile) {
    if (!panelOpen) return null;
    return (
      <>
        <Box
          position="fixed" inset="0" zIndex={70} bg="rgba(0,0,0,0.55)"
          onClick={() => setPanelOpen(false)}
        />
        <Flex
          as="aside"
          position="fixed" top="0" right="0" bottom="0" zIndex={71}
          w="min(360px, 88vw)" direction="column"
          bg="bg" borderLeftWidth="1px" borderColor="line"
        >
          <Flex
            align="center" justify="space-between" flex="none"
            px="18px" h="48px" borderBottomWidth="1px" borderColor="line"
          >
            <chakra.span fontFamily="mono" fontSize="12px" fontWeight="700" letterSpacing="0.14em" color="muted">
              STATS
            </chakra.span>
            <chakra.button
              type="button" onClick={() => setPanelOpen(false)}
              aria-label="Close stats panel"
              display="flex" alignItems="center" justifyContent="center"
              w="28px" h="28px" borderRadius="6px" fontSize="13px"
              color="faint" cursor="pointer" _hover={{ color: "muted", bg: "raised" }}
            >
              ✕
            </chakra.button>
          </Flex>
          <Box flex="1" minH="0" overflowY="auto" px="20px" pt="14px" pb="28px">
            {children}
          </Box>
        </Flex>
      </>
    );
  }

  // Desktop: the TopBar toggle can hide it; when shown it's resizable within
  // [min, max] (clamped by ctx).
  if (panelMode === "hidden") return null;

  // Always render the same Box so the ResizeHandle stays in the same DOM node
  // across width=0 ↔ width>0 transitions — pointer capture survives the re-render.
  return (
    <Box
      as="aside"
      position="relative"
      flex="none"
      w={`${panelWidth}px`}
      style={{
        overflow: panelWidth === 0 ? "visible" : "hidden",
        pointerEvents: panelWidth === 0 ? "none" : undefined,
      }}
    >
      <ResizeHandle side="left" width={panelWidth} onResize={setPanelWidth} />

      {panelWidth > 0 && (
        <Box
          h="100%"
          overflowY="auto"
          borderLeftWidth="1px"
          borderColor="line"
          px="24px"
          pt="14px"
          pb="28px"
        >
          {children}
        </Box>
      )}
    </Box>
  );
}
