"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

export const NAV_MAX_WIDTH = 360;
const NAV_DEFAULT_WIDTH = 216;

export const PANEL_MAX_WIDTH = 480;
const PANEL_DEFAULT_WIDTH = 300;

const NAV_WIDTH_KEY = "prismarity:nav-width";
const PANEL_WIDTH_KEY = "prismarity:panel-width";
const CHAT_LAYOUT_KEY = "prismarity:chat-layout";

export type ChatLayout = "combined" | "split";

// Width at which the NavRail switches from label+icon to icon-only.
export const NAV_COLLAPSE_AT = 168;

function clamp(w: number, max: number) {
  return Math.min(max, Math.max(0, w));
}

interface LayoutState {
  navWidth: number;
  setNavWidth: (w: number) => void;
  panelWidth: number;
  setPanelWidth: (w: number) => void;
  chatLayout: ChatLayout;
  setChatLayout: (l: ChatLayout) => void;
}

const LayoutContext = createContext<LayoutState | null>(null);

export function LayoutProvider({ children }: { children: React.ReactNode }) {
  const [navWidth, setNavWidthState] = useState(NAV_DEFAULT_WIDTH);
  const [panelWidth, setPanelWidthState] = useState(PANEL_DEFAULT_WIDTH);
  const [chatLayout, setChatLayoutState] = useState<ChatLayout>("combined");

  // Hydrate from localStorage after mount (not available during SSR).
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    const nav = Number(localStorage.getItem(NAV_WIDTH_KEY));
    if (!Number.isNaN(nav) && nav >= 0) setNavWidthState(clamp(nav, NAV_MAX_WIDTH));

    const panel = Number(localStorage.getItem(PANEL_WIDTH_KEY));
    if (!Number.isNaN(panel) && panel >= 0) setPanelWidthState(clamp(panel, PANEL_MAX_WIDTH));

    const layout = localStorage.getItem(CHAT_LAYOUT_KEY);
    if (layout === "combined" || layout === "split") setChatLayoutState(layout);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  const setNavWidth = useCallback((w: number) => {
    const next = clamp(w, NAV_MAX_WIDTH);
    setNavWidthState(next);
    localStorage.setItem(NAV_WIDTH_KEY, String(next));
  }, []);

  const setPanelWidth = useCallback((w: number) => {
    const next = clamp(w, PANEL_MAX_WIDTH);
    setPanelWidthState(next);
    localStorage.setItem(PANEL_WIDTH_KEY, String(next));
  }, []);

  const setChatLayout = useCallback((l: ChatLayout) => {
    setChatLayoutState(l);
    localStorage.setItem(CHAT_LAYOUT_KEY, l);
  }, []);

  return (
    <LayoutContext.Provider value={{ navWidth, setNavWidth, panelWidth, setPanelWidth, chatLayout, setChatLayout }}>
      {children}
    </LayoutContext.Provider>
  );
}

export function useLayout(): LayoutState {
  const ctx = useContext(LayoutContext);
  if (!ctx) throw new Error("useLayout must be used within a LayoutProvider");
  return ctx;
}
