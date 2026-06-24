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
