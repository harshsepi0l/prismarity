"use client";

import { Box, Flex, Text, chakra } from "@chakra-ui/react";
import { useLayout } from "../useLayout";
import { useStats } from "../useStats";
import { ResizeHandle } from "./ResizeHandle";

// Compact form for the collapsed strip — "1.2k" instead of "1,234".
function shortNum(n: number): string {
  if (n < 1000) return String(n);
  if (n < 1_000_000) return `${(n / 1000).toFixed(n < 10_000 ? 1 : 0)}k`;
  return `${(n / 1_000_000).toFixed(1)}m`;
}

function CollapseToggle({ hidden, onClick }: { hidden: boolean; onClick: () => void }) {
  return (
    <chakra.button
      type="button"
      onClick={onClick}
      title={hidden ? "Show stats" : "Hide stats"}
      aria-label={hidden ? "Show stats" : "Hide stats"}
      display="flex"
      alignItems="center"
      justifyContent="center"
      h="28px"
      w="28px"
      flex="none"
      borderRadius="7px"
      color="muted"
      cursor="pointer"
      transition="background .12s, color .12s"
      _hover={{ bg: "raised", color: "text" }}
    >
      <svg width="15" height="15" viewBox="0 0 20 20" fill="none" aria-hidden>
        <path
          d={hidden ? "M13 4 L7 10 L13 16" : "M7 4 L13 10 L7 16"}
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </chakra.button>
  );
}

// Wraps a right-hand panel: owns the chrome (border, scroll, padding, width)
// and a left-edge drag handle to resize. The wrapped panel supplies content
// sections only. Collapsing trades the full panel for a slim live-glance strip
// — viewer count + live dot — so stream health stays visible either way.
export function ResizableSidePanel({ children }: { children: React.ReactNode }) {
  const { panelWidth, setPanelWidth, panelHidden, togglePanel } = useLayout();
  const { anyLive, combinedViewers } = useStats();

  if (panelHidden) {
    return (
      <Flex
        as="aside"
        direction="column"
        align="center"
        flex="none"
        w="52px"
        borderLeftWidth="1px"
        borderColor="line"
        py="22px"
        gap="14px"
      >
        <CollapseToggle hidden onClick={togglePanel} />
        <Box w="22px" h="1px" bg="line" />
        <Box
          w="8px"
          h="8px"
          borderRadius="full"
          bg={anyLive ? "#FF5C5C" : "#5C6479"}
          animation={anyLive ? "pris-pulse 1.4s ease-in-out infinite" : undefined}
        />
        <Text fontFamily="mono" fontSize="11px" fontWeight="600" color="muted">
          {anyLive ? shortNum(combinedViewers) : "—"}
        </Text>
      </Flex>
    );
  }

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
        pt="14px"
        pb="28px"
      >
        <Flex justify="flex-end" mb="8px">
          <CollapseToggle hidden={false} onClick={togglePanel} />
        </Flex>
        {children}
      </Box>
    </Box>
  );
}
