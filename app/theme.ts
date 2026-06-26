import { createSystem, defaultConfig, defineConfig } from "@chakra-ui/react";

// Prismarity design language — dark "broadcast control room".
// Platform colors are functional (encode data), not decorative.
const config = defineConfig({
  globalCss: {
    "html, body, #__next": { height: "100%", bg: "#000000" },
    body: {
      color: "text",
      fontFamily: "body",
    },
    "::-webkit-scrollbar": { width: "8px", height: "8px" },
    "::-webkit-scrollbar-track": { background: "transparent" },
    "::-webkit-scrollbar-thumb": { background: "#232a38", borderRadius: "6px" },
    "::-webkit-scrollbar-thumb:hover": { background: "#2f3850" },
    // Pop-out lift + shadow on all interactive elements. Platform chips and mode
    // buttons layer a colored glow on top via component-level _hover.
    "button:not([disabled]), a": {
      transition: "box-shadow .15s, transform .12s",
    },
    "button:not([disabled]):hover, a:hover": {
      transform: "translateY(-1px)",
      boxShadow: "0 6px 24px rgba(0,0,0,0.65), 0 0 0 1px rgba(255,255,255,0.05)",
    },
    "button:not([disabled]):active, a:active": {
      transform: "translateY(0px) scale(0.97)",
      boxShadow: "0 2px 8px rgba(0,0,0,0.5)",
    },
  },
  theme: {
    keyframes: {
      "pris-pulse": {
        "0%, 100%": { opacity: 1 },
        "50%": { opacity: 0.3 },
      },
    },
    tokens: {
      colors: {
        // Surface hierarchy
        bg:        { value: "#0E1118" },
        panel:     { value: "#171B26" },
        raised:    { value: "#1F2532" },
        line:      { value: "#1B2130" },
        field:     { value: "#12161F" },
        fieldLine: { value: "#232A38" },
        // Text
        text:  { value: "#D6DAE6" },
        msg:   { value: "#D6DAE6" },
        muted: { value: "#8B93A7" },
        faint: { value: "#5C6479" },
        // Platform identity (functional)
        twitch:  { value: "#A66CFF" },
        youtube: { value: "#FF5C5C" },
        kick:    { value: "#5BE37D" },
      },
      fonts: {
        heading: { value: "var(--font-space-grotesk), sans-serif" },
        body:    { value: "var(--font-ibm-plex-sans), sans-serif" },
        mono:    { value: "var(--font-ibm-plex-mono), monospace" },
      },
    },
  },
});

export const system = createSystem(defaultConfig, config);
