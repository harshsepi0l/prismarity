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
      "beacon-pulse": {
        "0%, 100%": { opacity: 1, transform: "scale(1)" },
        "50%": { opacity: 0.5, transform: "scale(0.85)" },
      },
      "beacon-ring": {
        "0%": { opacity: 0.6, transform: "scale(1)" },
        "100%": { opacity: 0, transform: "scale(2.8)" },
      },
      // Beacon signal art — the classic Wi-Fi "connecting" sweep. The centre dot
      // lights first, then the inner arc, then the outer arc (bottom-to-top),
      // all hold briefly, then reset together at 100% so it loops cleanly.
      "signal-wifi-1": { "0%": { opacity: 0.25 }, "16%, 80%": { opacity: 1 }, "100%": { opacity: 0.25 } },
      "signal-wifi-2": { "0%, 16%": { opacity: 0.25 }, "38%, 80%": { opacity: 1 }, "100%": { opacity: 0.25 } },
      "signal-wifi-3": { "0%, 38%": { opacity: 0.25 }, "58%, 80%": { opacity: 1 }, "100%": { opacity: 0.25 } },
      // Logo electrons travel their orbit path (offset-distance 0→100%); paired
      // with a steps() timing they snap pixel-to-pixel along the sprite grid.
      "pel-orbit": { from: { offsetDistance: "0%" }, to: { offsetDistance: "100%" } },
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
        heading: { value: "var(--font-inter), sans-serif" },
        body:    { value: "var(--font-inter), sans-serif" },
        mono:    { value: "var(--font-ibm-plex-mono), monospace" },
      },
    },
    semanticTokens: {
      colors: {
        // Chakra's default semantic `bg` token is white in light mode and shadows
        // our raw `bg` color token — so `bg="bg"` rendered white (this app has no
        // dark-mode toggle). Pin it to our dark canvas so `bg="bg"` is always dark.
        bg: { DEFAULT: { value: "#0E1118" } },
      },
    },
  },
});

export const system = createSystem(defaultConfig, config);
