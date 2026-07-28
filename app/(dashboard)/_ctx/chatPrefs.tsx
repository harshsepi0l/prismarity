"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

// Per-user chat display preferences, reimplemented in our own code from the
// feature set popularised by the BetterTTV extension (see
// docs/bttv-extension-memory.md). All pure client-side, persisted to
// localStorage — no server round-trip. Kept in its own lightweight context so
// toggling a pref only re-renders the feed, not the whole dashboard, and so the
// value identity is stable across the frequent message re-renders (a new message
// must NOT churn this context, or every ChatMessage would re-render).
export interface ChatPrefs {
  // Lighten hard-to-read (very dark) username colors against the dark chat rows.
  readableColors: boolean;
  // Show the per-message timestamp on the right of each row.
  timestamps: boolean;
  // Pause auto-scroll while the cursor is over the feed (auto-resumes after a few
  // seconds so a fast chat never freezes if the cursor is left resting on it).
  pauseOnHover: boolean;
  // Rows whose text contains any of these get an amber highlight treatment.
  highlightKeywords: string[];
  // Messages whose text contains any of these are hidden from the feed entirely.
  blacklistKeywords: string[];
}

const DEFAULTS: ChatPrefs = {
  readableColors: true,
  timestamps: true,
  pauseOnHover: true,
  highlightKeywords: [],
  blacklistKeywords: [],
};

const STORAGE_KEY = "prismarity:chat-prefs";

interface ChatPrefsStore extends ChatPrefs {
  setReadableColors: (v: boolean) => void;
  setTimestamps: (v: boolean) => void;
  setPauseOnHover: (v: boolean) => void;
  setHighlightKeywords: (v: string[]) => void;
  setBlacklistKeywords: (v: string[]) => void;
}

const Ctx = createContext<ChatPrefsStore | null>(null);

export function ChatPrefsProvider({ children }: { children: React.ReactNode }) {
  const [prefs, setPrefs] = useState<ChatPrefs>(DEFAULTS);

  // Hydrate from localStorage after mount (SSR-safe — server has no storage).
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Partial<ChatPrefs>;
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setPrefs({
          readableColors: parsed.readableColors ?? DEFAULTS.readableColors,
          timestamps: parsed.timestamps ?? DEFAULTS.timestamps,
          pauseOnHover: parsed.pauseOnHover ?? DEFAULTS.pauseOnHover,
          highlightKeywords: parsed.highlightKeywords ?? DEFAULTS.highlightKeywords,
          blacklistKeywords: parsed.blacklistKeywords ?? DEFAULTS.blacklistKeywords,
        });
      }
    } catch {
      /* corrupt/absent — fall back to defaults */
    }
  }, []);

  const update = useCallback((patch: Partial<ChatPrefs>) => {
    setPrefs((prev) => {
      const next = { ...prev, ...patch };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        /* private mode / quota — pref still applies for the session */
      }
      return next;
    });
  }, []);

  const value = useMemo<ChatPrefsStore>(
    () => ({
      ...prefs,
      setReadableColors: (v) => update({ readableColors: v }),
      setTimestamps: (v) => update({ timestamps: v }),
      setPauseOnHover: (v) => update({ pauseOnHover: v }),
      setHighlightKeywords: (v) => update({ highlightKeywords: v }),
      setBlacklistKeywords: (v) => update({ blacklistKeywords: v }),
    }),
    [prefs, update]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useChatPrefs(): ChatPrefsStore {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useChatPrefs must be used within a ChatPrefsProvider");
  return ctx;
}

// Case-insensitive substring match of `text` against any non-empty keyword.
// Shared by the highlight (per-row styling) and blacklist (feed filtering) paths.
export function matchesKeywords(text: string, keywords: string[]): boolean {
  if (!text || keywords.length === 0) return false;
  const haystack = text.toLowerCase();
  for (const k of keywords) {
    const needle = k.trim().toLowerCase();
    if (needle.length > 0 && haystack.includes(needle)) return true;
  }
  return false;
}

// ── Readable username colors ──────────────────────────────────────────────────
// Chat rows sit on a dark background in BOTH light and dark app themes (platform
// rows are a deep tinted glass, self rows use a neutral colour, not the chatter's
// colour). So a legible-colour pass only needs to lift very DARK custom colours
// up to a minimum lightness; already-bright colours pass through untouched.
const MIN_LIGHTNESS = 0.5;

export function makeReadableColor(input: string): string {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(input.trim());
  if (!m) return input; // not a hex colour we can reason about — leave it
  const hexDigits = m[1];
  let r: number, g: number, b: number;
  if (hexDigits.length === 3) {
    r = parseInt(hexDigits[0] + hexDigits[0], 16);
    g = parseInt(hexDigits[1] + hexDigits[1], 16);
    b = parseInt(hexDigits[2] + hexDigits[2], 16);
  } else {
    r = parseInt(hexDigits.slice(0, 2), 16);
    g = parseInt(hexDigits.slice(2, 4), 16);
    b = parseInt(hexDigits.slice(4, 6), 16);
  }
  const [h, s, l] = rgbToHsl(r, g, b);
  if (l >= MIN_LIGHTNESS) return input;
  const [nr, ng, nb] = hslToRgb(h, s, MIN_LIGHTNESS);
  return `#${toHex(nr)}${toHex(ng)}${toHex(nb)}`;
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  switch (max) {
    case r:
      h = (g - b) / d + (g < b ? 6 : 0);
      break;
    case g:
      h = (b - r) / d + 2;
      break;
    default:
      h = (r - g) / d + 4;
  }
  return [h / 6, s, l];
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  if (s === 0) {
    const v = Math.round(l * 255);
    return [v, v, v];
  }
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return [
    Math.round(hue2rgb(p, q, h + 1 / 3) * 255),
    Math.round(hue2rgb(p, q, h) * 255),
    Math.round(hue2rgb(p, q, h - 1 / 3) * 255),
  ];
}

function toHex(n: number): string {
  return n.toString(16).padStart(2, "0");
}
