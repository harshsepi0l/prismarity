"use client";

import { Box } from "@chakra-ui/react";
import { useLayout } from "../useLayout";
import { ResizeHandle } from "./ResizeHandle";

// Wraps a right-hand panel: owns the chrome (border, scroll, padding, width)
// and a left-edge drag handle to resize. The wrapped panel supplies content
// sections only.
export function ResizableSidePanel({ children }: { children: React.ReactNode }) {
  const { panelWidth, setPanelWidth } = useLayout();

  return (
    <Box position="relative" flex="none" w={`${panelWidth}px`}>
      <ResizeHandle side="left" width={panelWidth} onResize={setPanelWidth} />
      <Box
        as="aside"
        h="100%"
        overflowY="auto"
        borderLeftWidth="1px"
        borderColor="line"
        px="24px"
        pt="22px"
        pb="28px"
      >
        {children}
      </Box>
    </Box>
  );
}
