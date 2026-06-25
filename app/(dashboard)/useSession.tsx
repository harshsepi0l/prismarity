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
import type { Role } from "@/lib/auth/types";

// The viewer's role for the current session.
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

// Modes you may use for a channel given your role on it (highest → lowest).
export function allowedModes(role: Role): Mode[] {
  if (role === "creator") return ["creator", "moderator", "viewer"];
  if (role === "moderator") return ["moderator", "viewer"];
  return ["viewer"];
}

// Keep the chosen mode if you're entitled to it for this role, else drop to viewer.
export function clampMode(mode: Mode, role: Role): Mode {
  return allowedModes(role).includes(mode) ? mode : "viewer";
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
  // Platforms the user has actually connected (logged into). Drives which
  // platform controls are enabled and which stats show.
  connectedPlatforms: Set<Platform>;
  // VIEW: which platforms show in the feed (+ VODs), remembered per mode and
  // intersected with connected platforms.
  activeFilters: Set<Platform>;
  toggleFilter: (p: Platform) => void;
  // SEND: which platforms the composer posts to (Creator multi-select).
  sendTargets: Set<Platform>;
  toggleSendTarget: (p: Platform) => void;
}

const SessionContext = createContext<SessionState | null>(null);

export function SessionProvider({
  connectedPlatforms: connectedInput = [],
  children,
}: {
  connectedPlatforms?: Platform[];
  children: React.ReactNode;
}) {
  const [mode, setModeState] = useState<Mode>("creator");
  const [viewByMode, setViewByMode] = useState<ViewByMode>(defaultViewByMode);
  const [creatorSend, setCreatorSend] = useState<Platform[]>([...ALL]);

  const connectedPlatforms = useMemo(
    () => new Set(connectedInput),
    [connectedInput]
  );

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
        /* ignore */
      }
    }

    const rawSend = localStorage.getItem(SEND_KEY);
    if (rawSend) {
      try {
        setCreatorSend(sanitize(JSON.parse(rawSend)));
      } catch {
        /* ignore */
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
      if (!connectedPlatforms.has(p)) return; // can't view an unconnected platform
      setViewByMode((prev) => {
        const cur = new Set(prev[mode]);
        if (cur.has(p)) cur.delete(p);
        else cur.add(p);
        const next = { ...prev, [mode]: [...cur] };
        localStorage.setItem(VIEW_KEY, JSON.stringify(next));
        return next;
      });
    },
    [mode, connectedPlatforms]
  );

  const toggleSendTarget = useCallback(
    (p: Platform) => {
      if (!connectedPlatforms.has(p)) return; // can't send to an unconnected platform
      setCreatorSend((prev) => {
        const s = new Set(prev);
        if (s.has(p)) s.delete(p);
        else s.add(p);
        const arr = [...s];
        localStorage.setItem(SEND_KEY, JSON.stringify(arr));
        return arr;
      });
    },
    [connectedPlatforms]
  );

  // View/send only ever include connected platforms.
  const activeFilters = useMemo(
    () => new Set(viewByMode[mode].filter((p) => connectedPlatforms.has(p))),
    [viewByMode, mode, connectedPlatforms]
  );
  const sendTargets = useMemo(
    () => new Set(creatorSend.filter((p) => connectedPlatforms.has(p))),
    [creatorSend, connectedPlatforms]
  );

  return (
    <SessionContext.Provider
      value={{
        mode,
        setMode,
        connectedPlatforms,
        activeFilters,
        toggleFilter,
        sendTargets,
        toggleSendTarget,
      }}
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
