// ─────────────────────────────────────────────────────────────────────────────
// The component-facing color extract. Import from here instead of hardcoding
// hex/rgba anywhere. Two ways to consume color:
//
//   • Chakra props  → use the token name directly: <Box bg="panel" color="muted" />
//   • inline styles → use `c.*` below: style={{ background: c.field,
//                     border: `1px solid ${c.line}` }}
//
// `c.*` are CSS-var references (e.g. "var(--chakra-colors-panel)") for the same
// tokens defined in theme.ts, so they resolve to the right wash automatically
// when the color mode flips — no JS, no re-render needed. Names mirror the tokens.
//
// We build the var strings by hand rather than importing the Chakra `system`:
// touching the system at module load eagerly evaluates its recipes (which breaks
// in the server bundle), and it's unnecessary — Chakra's var names are just the
// dash-cased token path under the `chakra` prefix.
// ─────────────────────────────────────────────────────────────────────────────

// camelCase → kebab-case, matching Chakra's own css-var formatter (fieldLine →
// field-line), then wrap as the CSS custom-property reference.
const v = (name: string): string =>
  `var(--chakra-colors-${name.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)})`;

export const c = {
  // Surfaces
  bg: v("bg"),
  panel: v("panel"),
  raised: v("raised"),
  line: v("line"),
  lineStrong: v("lineStrong"),
  field: v("field"),
  fieldLine: v("fieldLine"),
  // Text ramp
  text: v("text"),
  muted: v("muted"),
  faint: v("faint"),
  // Accent + scrims
  accent: v("accent"),
  accentText: v("accentText"),
  overlay: v("overlay"),
  // Platform identity (functional; same in both washes)
  twitch: v("twitch"),
  youtube: v("youtube"),
  kick: v("kick"),
} as const;

// Functional platform colors as raw hex — for places that need the literal value
// (SVG fills, gradients, canvas). These are intentionally mode-independent.
export const PLATFORM = {
  twitch: "#A66CFF",
  youtube: "#FF5C5C",
  kick: "#5BE37D",
} as const;

// Fixed event/signal accents that carry their own identity (not the amber accent).
export const SIGNAL = {
  hype: "#F5A0FF", // hype-train pink
  hypeGold: "#F5C518", // golden kappa train
  beacon: "#38BDF8", // Beacon Wi-Fi signal blue
  warn: "#F5A623", // attention amber (offline-chat notice) — distinct from the brand accent
  danger: "#FF5C5C", // send/validation error red
  live: "#FF5C5C", // on-air / live-status red (same hue as danger, distinct role)
} as const;

// Tint a hex color at an alpha — the centralized way to make the translucent
// platform washes (e.g. alpha(PLATFORM.twitch, 0.3)) instead of literal rgba().
export function alpha(hex: string, a: number): string {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((ch) => ch + ch).join("") : h;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

// ── Amber accent tints ───────────────────────────────────────────────────────
// `accentMix(pct)` makes a translucent amber straight off the `accent` CSS var
// (for borders, washes, lines) — flips per mode, never hardcoded. alpha() can't
// do this, since `c.accent` is a var reference, not a hex literal. For a solid
// amber border/text use the `accent` token (or `c.accent`) directly.
export const accentMix = (pct: number): string =>
  `color-mix(in srgb, ${c.accent} ${pct}%, transparent)`;

// A very faint amber for the structural region dividers (topbar/nav/panel edges,
// chat section rules) — a warm tint of the accent, not an in-your-face gold line.
export const accentLine = accentMix(14);

// Hover treatment for the TopBar controls: an amber background wash plus a soft
// ambient glow (no hard ring). Spread into a button's `_hover`.
export const hoverGlow = {
  background: accentMix(13),
  boxShadow: `0 0 14px ${accentMix(24)}`,
} as const;

// TopBar button borders. The faint accentLine washes out on the light canvas, so
// light mode gets a touch more presence; dark keeps the faint tint. A Chakra
// conditional value — pass to a `borderColor` prop.
export const accentBorder = { _light: accentMix(58), _dark: accentMix(14) } as const;

// TopBar button resting background — the near-white `field` token in light mode
// (matching the chat's Watching pill), transparent in dark. Pass to a `bg` prop.
export const btnBg = { _light: "field", _dark: "transparent" } as const;
