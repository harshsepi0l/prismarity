"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import type { Platform } from "./chat/types";

// The viewer's role for the current session.
//  creator   — your own stream: composer + full broadcaster mod tools
//  moderator — a channel you moderate: composer + chat-mod tools, not yours
//  viewer    — watching others: read-only
export type Mode = "creator" | "viewer" | "moderator";

const MODE_KEY = "prismarity:mode";
const FILTERS_KEY = "prismarity:filters";
const ALL: Platform[] = ["twitch", "youtube", "kick"];

function isMode(v: string | null): v is Mode {
  return v === "creator" || v === "viewer" || v === "moderator";
}

interface SessionState {
  mode: Mode;
  setMode: (m: Mode) => void;
  activeFilters: Set<Platform>;
  toggleFilter: (p: Platform) => void;
}

const SessionContext = createContext<SessionState | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<Mode>("creator");
  const [activeFilters, setActiveFilters] = useState<Set<Platform>>(
    new Set(ALL)
  );

  // Hydrate from localStorage after mount (not available during SSR).
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    const m = localStorage.getItem(MODE_KEY);
    if (isMode(m)) setModeState(m);
    const f = localStorage.getItem(FILTERS_KEY);
    if (f !== null) {
      setActiveFilters(
        new Set(f.split(",").filter((x): x is Platform => ALL.includes(x as Platform)))
      );
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  const setMode = useCallback((m: Mode) => {
    setModeState(m);
    localStorage.setItem(MODE_KEY, m);
  }, []);

  const toggleFilter = useCallback((p: Platform) => {
    setActiveFilters((prev) => {
      const next = new Set(prev);
      if (next.has(p)) next.delete(p);
      else next.add(p);
      localStorage.setItem(FILTERS_KEY, [...next].join(","));
      return next;
    });
  }, []);

  return (
    <SessionContext.Provider value={{ mode, setMode, activeFilters, toggleFilter }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession(): SessionState {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used within a SessionProvider");
  return ctx;
}
