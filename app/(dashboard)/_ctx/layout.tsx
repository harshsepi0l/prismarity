"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";

// Expanded sidebar drag bounds — the "resize only to a certain extent" mode.
export const NAV_MAX_WIDTH = 340;
export const NAV_MIN_EXPANDED = 200;
const NAV_DEFAULT_WIDTH = 240;

// Stats panel: resizable within bounds when shown, or fully hidden. The min
// keeps the stat cards from crushing ("letters go down") as you drag it narrow.
export const PANEL_MAX_WIDTH = 480;
export const PANEL_MIN_EXPANDED = 260;
const PANEL_DEFAULT_WIDTH = 300;

const NAV_WIDTH_KEY = "prismarity:nav-width";
const NAV_MODE_KEY = "prismarity:nav-mode";
const PANEL_WIDTH_KEY = "prismarity:panel-width";
const PANEL_MODE_KEY = "prismarity:panel-mode";
const CHAT_LAYOUT_KEY = "prismarity:chat-layout";

export type ChatLayout = "combined" | "split";
export type PanelMode = "expanded" | "hidden";

// Sidebar has three user-cyclable modes: expanded (resizable within bounds), an
// icon-only rail (pfp + platform dot), or fully hidden.
export type NavMode = "expanded" | "rail" | "hidden";
const NAV_MODE_ORDER: NavMode[] = ["expanded", "rail", "hidden"];

// Fixed width of the icon-only rail.
export const NAV_RAIL_WIDTH = 60;

// Viewport breakpoints — mirror Chakra's defaults (md 768 / lg 1024). Below `md`
// the nav/side panel become overlay drawers ("mobile").
export const MD_BREAKPOINT = 768;
export const LG_BREAKPOINT = 1024;

// SSR-stable seed so the server and first client render agree (desktop); the
// real width is measured in an effect after mount, avoiding hydration mismatch.
const SSR_VIEWPORT = 1280;

function clampExpanded(w: number) {
  return Math.min(NAV_MAX_WIDTH, Math.max(NAV_MIN_EXPANDED, w));
}
function clampPanel(w: number) {
  return Math.min(PANEL_MAX_WIDTH, Math.max(PANEL_MIN_EXPANDED, w));
}

interface LayoutState {
  navWidth: number;
  setNavWidth: (w: number) => void;
  navMode: NavMode;
  setNavMode: (m: NavMode) => void;
  cycleNavMode: () => void;
  panelWidth: number;
  setPanelWidth: (w: number) => void;
  panelMode: PanelMode;
  togglePanel: () => void;
  chatLayout: ChatLayout;
  setChatLayout: (l: ChatLayout) => void;

  // Viewport awareness.
  viewportWidth: number;
  isCompact: boolean; // < lg (1024)
  isMobile: boolean; // < md (768) — nav/panel become overlay drawers

  // Mobile drawer + shared overlay state (dispatchers accept functional updaters).
  navOpen: boolean;
  setNavOpen: Dispatch<SetStateAction<boolean>>;
  panelOpen: boolean;
  setPanelOpen: Dispatch<SetStateAction<boolean>>;
  // Shared so the NavRail search entry can reuse the TopBar's CommandSearch.
  searchOpen: boolean;
  setSearchOpen: Dispatch<SetStateAction<boolean>>;
}

const LayoutContext = createContext<LayoutState | null>(null);

export function LayoutProvider({ children }: { children: React.ReactNode }) {
  const [navWidth, setNavWidthState] = useState(NAV_DEFAULT_WIDTH);
  const [navMode, setNavModeState] = useState<NavMode>("expanded");
  const [panelWidth, setPanelWidthState] = useState(PANEL_DEFAULT_WIDTH);
  const [panelMode, setPanelModeState] = useState<PanelMode>("expanded");
  const [chatLayout, setChatLayoutState] = useState<ChatLayout>("combined");

  const [viewportWidth, setViewportWidth] = useState(SSR_VIEWPORT);
  const [navOpen, setNavOpen] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  // Hydrate persisted widths/mode/layout from localStorage after mount (no SSR).
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    const nav = Number(localStorage.getItem(NAV_WIDTH_KEY));
    if (!Number.isNaN(nav) && nav > 0) setNavWidthState(clampExpanded(nav));

    const mode = localStorage.getItem(NAV_MODE_KEY);
    if (mode === "expanded" || mode === "rail" || mode === "hidden") setNavModeState(mode);

    const panel = Number(localStorage.getItem(PANEL_WIDTH_KEY));
    if (!Number.isNaN(panel) && panel > 0) setPanelWidthState(clampPanel(panel));

    const panelM = localStorage.getItem(PANEL_MODE_KEY);
    if (panelM === "expanded" || panelM === "hidden") setPanelModeState(panelM);

    const layout = localStorage.getItem(CHAT_LAYOUT_KEY);
    if (layout === "combined" || layout === "split") setChatLayoutState(layout);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  // Track viewport width (rAF-throttled). Measured once on mount, then on resize.
  useEffect(() => {
    let raf = 0;
    const measure = () => {
      raf = 0;
      const w = window.innerWidth;
      setViewportWidth(w);
      // Leaving mobile auto-dismisses the overlay drawers so they can't get
      // stranded open when the layout returns to the docked desktop shell.
      if (w >= MD_BREAKPOINT) {
        setNavOpen(false);
        setPanelOpen(false);
      }
    };
    const onResize = () => {
      if (!raf) raf = requestAnimationFrame(measure);
    };
    measure();
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  const setNavWidth = useCallback((w: number) => {
    const next = clampExpanded(w);
    setNavWidthState(next);
    localStorage.setItem(NAV_WIDTH_KEY, String(next));
  }, []);

  const setNavMode = useCallback((m: NavMode) => {
    setNavModeState(m);
    localStorage.setItem(NAV_MODE_KEY, m);
  }, []);

  const cycleNavMode = useCallback(() => {
    setNavModeState((prev) => {
      const next = NAV_MODE_ORDER[(NAV_MODE_ORDER.indexOf(prev) + 1) % NAV_MODE_ORDER.length];
      localStorage.setItem(NAV_MODE_KEY, next);
      return next;
    });
  }, []);

  const setPanelWidth = useCallback((w: number) => {
    const next = clampPanel(w);
    setPanelWidthState(next);
    localStorage.setItem(PANEL_WIDTH_KEY, String(next));
  }, []);

  const togglePanel = useCallback(() => {
    setPanelModeState((prev) => {
      const next = prev === "expanded" ? "hidden" : "expanded";
      localStorage.setItem(PANEL_MODE_KEY, next);
      return next;
    });
  }, []);

  const setChatLayout = useCallback((l: ChatLayout) => {
    setChatLayoutState(l);
    localStorage.setItem(CHAT_LAYOUT_KEY, l);
  }, []);

  const isCompact = viewportWidth < LG_BREAKPOINT;
  const isMobile = viewportWidth < MD_BREAKPOINT;

  return (
    <LayoutContext.Provider
      value={{
        navWidth, setNavWidth,
        navMode, setNavMode, cycleNavMode,
        panelWidth, setPanelWidth,
        panelMode, togglePanel,
        chatLayout, setChatLayout,
        viewportWidth, isCompact, isMobile,
        navOpen, setNavOpen,
        panelOpen, setPanelOpen,
        searchOpen, setSearchOpen,
      }}
    >
      {children}
    </LayoutContext.Provider>
  );
}

export function useLayout(): LayoutState {
  const ctx = useContext(LayoutContext);
  if (!ctx) throw new Error("useLayout must be used within a LayoutProvider");
  return ctx;
}
