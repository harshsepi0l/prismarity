"use client";

import { useRef, useState } from "react";
import { Box, Flex } from "@chakra-ui/react";
import { c, accentMix } from "../../theme-colors";

// Drag below this width → snap fully closed. Expanding from 0 tracks freely.
const SNAP_THRESHOLD = 48;

const GRIP_SVG = (
  <svg width="6" height="16" viewBox="0 0 6 16" fill={accentMix(80)} aria-hidden>
    <circle cx="1.5" cy="2"  r="1.2" />
    <circle cx="4.5" cy="2"  r="1.2" />
    <circle cx="1.5" cy="8"  r="1.2" />
    <circle cx="4.5" cy="8"  r="1.2" />
    <circle cx="1.5" cy="14" r="1.2" />
    <circle cx="4.5" cy="14" r="1.2" />
  </svg>
);

interface ResizeHandleProps {
  side: "left" | "right";
  width: number;
  onResize: (width: number) => void;
}

export function ResizeHandle({ side, width, onResize }: ResizeHandleProps) {
  const start = useRef({ x: 0, w: 0 });
  const [active, setActive] = useState(false);
  const collapsed = width === 0;

  function onPointerDown(e: React.PointerEvent) {
    start.current = { x: e.clientX, w: width };
    e.currentTarget.setPointerCapture(e.pointerId);
    e.stopPropagation();
    setActive(true);
  }

  function onPointerMove(e: React.PointerEvent) {
    if (e.buttons !== 1) return;
    const dx = e.clientX - start.current.x;
    const delta = side === "right" ? dx : -dx;
    const raw = start.current.w + delta;
    const next = start.current.w === 0 ? Math.max(0, raw) : raw < SNAP_THRESHOLD ? 0 : raw;
    onResize(next);
  }

  function onPointerUp() {
    setActive(false);
  }

  // Wider zone when collapsed so the edge is easier to grab.
  const zoneW = collapsed ? 20 : 8;
  const zoneEdge = collapsed ? "-10px" : "-4px";

  return (
    <Box
      position="absolute"
      top="0"
      bottom="0"
      {...(side === "right" ? { right: zoneEdge } : { left: zoneEdge })}
      w={`${zoneW}px`}
      zIndex={20}
      cursor="col-resize"
      style={{ pointerEvents: "auto" }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onMouseEnter={() => setActive(true)}
      onMouseLeave={() => setActive(false)}
    >
      {/* Full-height line */}
      <Box
        position="absolute"
        top="0"
        bottom="0"
        w="2px"
        borderRadius="2px"
        style={{
          left: "50%",
          transform: "translateX(-50%)",
          pointerEvents: "none",
          background: active ? accentMix(50) : "transparent",
          transition: "background .15s",
        }}
      />

      {/* Centered grip pill — the [|] the user asked for */}
      <Flex
        position="absolute"
        top="50%"
        align="center"
        justify="center"
        w="20px"
        h="52px"
        borderRadius="6px"
        style={{
          left: "50%",
          transform: "translate(-50%, -50%)",
          pointerEvents: "none",
          background: active ? c.raised : "transparent",
          border: active ? `1px solid ${accentMix(38)}` : "1px solid transparent",
          transition: "background .15s, border-color .15s",
        }}
      >
        <Box
          style={{
            opacity: active ? 1 : 0,
            transition: "opacity .15s",
          }}
        >
          {GRIP_SVG}
        </Box>
      </Flex>
    </Box>
  );
}
