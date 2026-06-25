"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { Platform } from "./chat/types";

// The viewer's role for the current session.
//  creator   — your own stream: composer + full broadcaster mod tools
//  moderator — a channel you moderate: composer + chat-mod tools, not yours
//  viewer    — watching others: read-only-ish (can still chat)
export type Mode = "creator" | "viewer" | "moderator";

const MODE_KEY = "prismarity:mode";
const VIEW_KEY = "prismarity:view-by-mode";
const SEND_KEY = "prismarity:send-targets";
const ALL: Platform[] = ["twitch", "youtube", "kick"];
const MODES: Mode[] = ["creator", "moderator", "viewer"];

function isMode(v: string | null): v is Mode {
  return v === "creator" || v === "viewer" || v === "moderator";
}

function sanitize(arr: unknown): Platform[] {
  if (!Array.isArray(arr)) return [...ALL];
  return arr.filter((x): x is Platform => ALL.includes(x as Platform));
}

type ViewByMode = Record<Mode, Platform[]>;

const defaultViewByMode = (): ViewByMode => ({
  creator: [...ALL],
  moderator: [...ALL],
  viewer: [...ALL],
});

interface SessionState {
  mode: Mode;
  setMode: (m: Mode) => void;
  // VIEW: which platforms show in the feed (and VODs). Remembered per mode.
  activeFilters: Set<Platform>;
  toggleFilter: (p: Platform) => void;
  // SEND: which platforms the composer posts to (Creator multi-select; the
  // other modes derive their target from the active channel). Remembered.
  sendTargets: Set<Platform>;
  toggleSendTarget: (p: Platform) => void;
}

const SessionContext = createContext<SessionState | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<Mode>("creator");
  const [viewByMode, setViewByMode] = useState<ViewByMode>(defaultViewByMode);
  const [creatorSend, setCreatorSend] = useState<Platform[]>([...ALL]);

  // Hydrate from localStorage after mount (not available during SSR).
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    const m = localStorage.getItem(MODE_KEY);
    if (isMode(m)) setModeState(m);

    const rawView = localStorage.getItem(VIEW_KEY);
    if (rawView) {
      try {
        const parsed = JSON.parse(rawView) as Record<string, unknown>;
        const next = defaultViewByMode();
        for (const md of MODES) {
          if (md in parsed) next[md] = sanitize(parsed[md]);
        }
        setViewByMode(next);
      } catch {
        /* ignore malformed value */
      }
    }

    const rawSend = localStorage.getItem(SEND_KEY);
    if (rawSend) {
      try {
        setCreatorSend(sanitize(JSON.parse(rawSend)));
      } catch {
        /* ignore malformed value */
      }
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  const setMode = useCallback((m: Mode) => {
    setModeState(m);
    localStorage.setItem(MODE_KEY, m);
  }, []);

  const toggleFilter = useCallback(
    (p: Platform) => {
      setViewByMode((prev) => {
        const cur = new Set(prev[mode]);
        if (cur.has(p)) cur.delete(p);
        else cur.add(p);
        const next = { ...prev, [mode]: [...cur] };
        localStorage.setItem(VIEW_KEY, JSON.stringify(next));
        return next;
      });
    },
    [mode]
  );

  const toggleSendTarget = useCallback((p: Platform) => {
    setCreatorSend((prev) => {
      const s = new Set(prev);
      if (s.has(p)) s.delete(p);
      else s.add(p);
      const arr = [...s];
      localStorage.setItem(SEND_KEY, JSON.stringify(arr));
      return arr;
    });
  }, []);

  // Memoized so the Set identity is stable between unrelated re-renders
  // (effects elsewhere depend on these).
  const activeFilters = useMemo(() => new Set(viewByMode[mode]), [viewByMode, mode]);
  const sendTargets = useMemo(() => new Set(creatorSend), [creatorSend]);

  return (
    <SessionContext.Provider
      value={{ mode, setMode, activeFilters, toggleFilter, sendTargets, toggleSendTarget }}
    >
      {children}
    </SessionContext.Provider>
  );
}

export function useSession(): SessionState {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used within a SessionProvider");
  return ctx;
}
