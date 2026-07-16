"use client";

import { Box } from "@chakra-ui/react";
import { useLayout } from "../_ctx/layout";
import { ResizeHandle } from "./ResizeHandle";

export function ResizableSidePanel({ children }: { children: React.ReactNode }) {
  const { panelWidth, setPanelWidth, isMobile, panelMode } = useLayout();

  // Mobile hides it so chat gets the full width; on desktop the TopBar toggle
  // can hide it too. When shown it's resizable within [min, max] (clamped by ctx).
  if (isMobile || panelMode === "hidden") return null;

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
