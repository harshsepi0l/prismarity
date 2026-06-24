"use client";

import { useRef } from "react";
import { Box } from "@chakra-ui/react";

// A draggable edge for resizing a panel. `side` is the edge the handle sits on:
// "right" for a left-docked panel (NavRail), "left" for a right-docked panel
// (SidePanel). Dragging the edge outward widens the panel either way.
interface ResizeHandleProps {
  side: "left" | "right";
  width: number;
  onResize: (width: number) => void;
}

export function ResizeHandle({ side, width, onResize }: ResizeHandleProps) {
  const start = useRef({ x: 0, w: 0 });

  function onPointerDown(e: React.PointerEvent) {
    start.current = { x: e.clientX, w: width };
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent) {
    if (e.buttons !== 1) return;
    const dx = e.clientX - start.current.x;
    const delta = side === "right" ? dx : -dx;
    onResize(start.current.w + delta);
  }

  return (
    <Box
      position="absolute"
      top="0"
      bottom="0"
      {...(side === "right" ? { right: "0", mr: "-3px" } : { left: "0", ml: "-3px" })}
      w="7px"
      zIndex={2}
      cursor="col-resize"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      _hover={{ bg: "fieldLine" }}
    />
  );
}
