import { createSystem, defaultConfig, defineConfig } from "@chakra-ui/react";

// ─────────────────────────────────────────────────────────────────────────────
// Prismarity design language — the SINGLE SOURCE OF TRUTH for color.
// Components must NOT hardcode hex/rgba: use Chakra tokens (`bg="panel"`,
// `color="muted"`, `bg="accent"`) or, for inline styles, the `c` map exported
// from ./theme-colors (which points at these same CSS vars and flips by mode).
//
// PALETTE holds the two washes. Dark = neutral grey-black (NOT blue-tinted).
// Light = light-grey (NOT white). Amber is the one decorative accent; platform
// colors are functional (they encode which service data came from) so they stay
// fixed across both modes.
// ─────────────────────────────────────────────────────────────────────────────
const PALETTE = {
  dark: {
    bg: "#0D0D0F",
    panel: "#151517",
    raised: "#202024",
    line: "#26262A",
    lineStrong: "#33333B",
    field: "#131315",
    fieldLine: "#2C2C31",
    text: "#E7E7EA",
    muted: "#96969E",
    faint: "#5E5E66",
    overlay: "rgba(0,0,0,0.6)",
  },
  // "Slate" wash — a properly grey light mode (not near-white). Surfaces sit
  // clearly below white so panels and cards read as distinct planes.
  light: {
    bg: "#D5D5DB",
    panel: "#DFDFE5",
    raised: "#E7E7ED",
    line: "#C7C7CF",
    lineStrong: "#BABAC3",
    field: "#EAEAF0",
    fieldLine: "#CDCDD5",
    text: "#1C1C1F",
    muted: "#5E5E67",
    faint: "#93939C",
    overlay: "rgba(20,20,24,0.4)",
  },
  // Amber accent — a touch deeper in light mode so it stays legible on a
  // light-grey canvas. `accentText` is the ink that sits ON amber fills.
  accent: { dark: "#E6B94D", light: "#B7791F" },
  accentText: "#0B0B0B",
  // Functional platform identity — identical in both modes.
  platform: { twitch: "#A66CFF", youtube: "#FF5C5C", kick: "#5BE37D" },
} as const;

// One semantic color token: { value: { _light, _dark } }. `_dark` activates
// under a `.dark` class on <html> (set by the color-mode provider); `_light`
// (== :root) is the fallback. See app/_ctx/color-mode.tsx.
const dual = (name: keyof typeof PALETTE.dark) => ({
  value: { _light: PALETTE.light[name], _dark: PALETTE.dark[name] },
});

const config = defineConfig({
  globalCss: {
    "html, body, #__next": { height: "100%", bg: "bg" },
    body: {
      color: "text",
      fontFamily: "body",
      // Now that the number/label "mono" slot is a proportional rounded face,
      // keep live-updating figures (counts, timers) from jittering by asking for
      // tabular figures where the font provides them.
      fontVariantNumeric: "tabular-nums",
    },
    "::-webkit-scrollbar": { width: "8px", height: "8px" },
    "::-webkit-scrollbar-track": { background: "transparent" },
    "::-webkit-scrollbar-thumb": { background: "fieldLine", borderRadius: "6px" },
    "::-webkit-scrollbar-thumb:hover": { background: "lineStrong" },
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
      // "Now playing" ticker — a continuous breaking-news crawl. The track holds
      // two copies of the label (gap between) and shifts by one full period
      // (--tkr px, = label + gap) so the trailing copy lands exactly where the
      // first began, looping seamlessly. Consumer picks direction via `reverse`
      // (NavRail runs it reversed → rightward). One-directional, no bounce.
      "nav-ticker": {
        from: { transform: "translateX(0)" },
        to: { transform: "translateX(var(--tkr, 0px))" },
      },
    },
    tokens: {
      colors: {
        // Platform identity (functional — fixed across light/dark).
        twitch:  { value: PALETTE.platform.twitch },
        youtube: { value: PALETTE.platform.youtube },
        kick:    { value: PALETTE.platform.kick },
        // Ink that sits on top of an amber `accent` fill.
        accentText: { value: PALETTE.accentText },
      },
      fonts: {
        // One rounded family everywhere. `ui-rounded` picks up the native rounded
        // system font (SF Pro/Compact Rounded on Apple) before the generic fall.
        // The "mono" slot is the same face now — see tabular-nums in globalCss.
        heading: { value: "var(--font-rounded), ui-rounded, system-ui, sans-serif" },
        body:    { value: "var(--font-rounded), ui-rounded, system-ui, sans-serif" },
        mono:    { value: "var(--font-rounded), ui-rounded, system-ui, sans-serif" },
      },
    },
    semanticTokens: {
      colors: {
        // Surface hierarchy + text ramp — each flips between the two washes.
        // These override Chakra's defaults (e.g. its `bg` is white in light mode).
        bg:         dual("bg"),
        panel:      dual("panel"),
        raised:     dual("raised"),
        line:       dual("line"),
        lineStrong: dual("lineStrong"),
        field:      dual("field"),
        fieldLine:  dual("fieldLine"),
        text:       dual("text"),
        // `msg` was a historical alias of `text`; kept so existing usages resolve.
        msg:        dual("text"),
        muted:      dual("muted"),
        faint:      dual("faint"),
        // Modal/scrim backdrop.
        overlay:    dual("overlay"),
        // The one decorative accent — amber.
        accent:     { value: { _light: PALETTE.accent.light, _dark: PALETTE.accent.dark } },
      },
    },
  },
});

export const system = createSystem(defaultConfig, config);
