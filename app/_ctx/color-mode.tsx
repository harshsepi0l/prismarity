"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// Color mode: light / dark / system. The user's choice is one of three; the
// *resolved* mode is always light or dark (system → the OS preference, live).
// Chakra's semantic tokens key off a `.dark` class on <html> (see theme.ts), so
// all this provider does is keep that class in sync and persist the choice.
//
// First paint is handled by <ThemeScript/> (rendered in app/layout.tsx) so
// there's no flash of the wrong wash before React hydrates.
// ─────────────────────────────────────────────────────────────────────────────

export type ColorMode = "light" | "dark" | "system";
type Resolved = "light" | "dark";

const STORAGE_KEY = "prismarity-theme";
const DEFAULT_MODE: ColorMode = "system";

// Kept in sync (by hand) with COLOR_MODE_SCRIPT in layout.tsx.
function systemPrefers(): Resolved {
  return typeof window !== "undefined" &&
    window.matchMedia("(prefers-color-scheme: light)").matches
    ? "light"
    : "dark";
}

function resolve(mode: ColorMode): Resolved {
  return mode === "system" ? systemPrefers() : mode;
}

function applyClass(resolved: Resolved) {
  const el = document.documentElement;
  el.classList.remove("light", "dark");
  el.classList.add(resolved);
}

interface ColorModeCtx {
  mode: ColorMode; // the user's choice (may be "system")
  resolved: Resolved; // what's actually showing (light | dark)
  setMode: (m: ColorMode) => void;
  mounted: boolean; // false during SSR/first render — guard mode-dependent UI
}

const Ctx = createContext<ColorModeCtx | null>(null);

export function ColorModeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ColorMode>(DEFAULT_MODE);
  const [resolved, setResolved] = useState<Resolved>("dark");
  const [mounted, setMounted] = useState(false);

  // Hydrate from storage once on mount (matches what the FOUC script applied).
  useEffect(() => {
    const stored = (localStorage.getItem(STORAGE_KEY) as ColorMode | null) ?? DEFAULT_MODE;
    setModeState(stored);
    setResolved(resolve(stored));
    setMounted(true);
  }, []);

  // Keep the <html> class + resolved value current whenever the choice changes,
  // and — while on "system" — follow live OS changes.
  useEffect(() => {
    if (!mounted) return;
    const next = resolve(mode);
    setResolved(next);
    applyClass(next);

    if (mode !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: light)");
    const onChange = () => {
      const r = systemPrefers();
      setResolved(r);
      applyClass(r);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [mode, mounted]);

  const setMode = useCallback((m: ColorMode) => {
    localStorage.setItem(STORAGE_KEY, m);
    setModeState(m);
  }, []);

  const value = useMemo<ColorModeCtx>(
    () => ({ mode, resolved, setMode, mounted }),
    [mode, resolved, setMode, mounted]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useColorMode(): ColorModeCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useColorMode must be used within ColorModeProvider");
  return ctx;
}

// Inline script string — sets the class before first paint so the initial wash
// is correct. Mirrors DEFAULT_MODE / STORAGE_KEY / systemPrefers.
const COLOR_MODE_SCRIPT = `(function(){try{var m=localStorage.getItem('${STORAGE_KEY}')||'${DEFAULT_MODE}';var d=m==='system'?(window.matchMedia('(prefers-color-scheme: light)').matches?'light':'dark'):m;var e=document.documentElement;e.classList.remove('light','dark');e.classList.add(d);}catch(_){document.documentElement.classList.add('dark');}})();`;

// The pre-paint theme script, as a component. It renders as real, executable
// JavaScript on the server (so the browser runs it while parsing the HTML — no
// flash), but as inert `text/plain` on the client. Without the swap, React 19
// warns "scripts inside React components are never executed on the client" and
// can treat the tag as a hydration mismatch — which recovers by re-rendering the
// tree and wiping the `.dark` class the script just set (the theme-toggle bug).
export function ThemeScript() {
  return (
    <script
      type={typeof window === "undefined" ? "text/javascript" : "text/plain"}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: COLOR_MODE_SCRIPT }}
    />
  );
}
