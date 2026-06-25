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
const ACTIVE_KEY = "prismarity:active-platforms";
const ALL: Platform[] = ["twitch", "youtube", "kick"];

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

interface SessionState {
  mode: Mode;
  setMode: (m: Mode) => void;
  // Platforms the user has actually connected (logged into). Drives which
  // platform controls are enabled.
  connectedPlatforms: Set<Platform>;
  // A SINGLE set of active platforms drives both reading and writing — the
  // top-bar chips and the composer's send glows are the same state, so toggling
  // either keeps view and send in sync. Always intersected with connected.
  activeFilters: Set<Platform>;
  toggleFilter: (p: Platform) => void;
  // Aliases over the same set, for the composer's send-target glows.
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
  const [activePlatforms, setActivePlatforms] = useState<Platform[]>([...ALL]);

  const connectedPlatforms = useMemo(
    () => new Set(connectedInput),
    [connectedInput]
  );

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    const m = localStorage.getItem(MODE_KEY);
    if (isMode(m)) setModeState(m);

    const raw = localStorage.getItem(ACTIVE_KEY);
    if (raw) {
      try {
        setActivePlatforms(sanitize(JSON.parse(raw)));
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

  // One toggle for both view and send.
  const toggle = useCallback(
    (p: Platform) => {
      if (!connectedPlatforms.has(p)) return; // can't act on an unconnected platform
      setActivePlatforms((prev) => {
        const s = new Set(prev);
        if (s.has(p)) s.delete(p);
        else s.add(p);
        const arr = [...s];
        localStorage.setItem(ACTIVE_KEY, JSON.stringify(arr));
        return arr;
      });
    },
    [connectedPlatforms]
  );

  // The active set only ever includes connected platforms.
  const active = useMemo(
    () => new Set(activePlatforms.filter((p) => connectedPlatforms.has(p))),
    [activePlatforms, connectedPlatforms]
  );

  return (
    <SessionContext.Provider
      value={{
        mode,
        setMode,
        connectedPlatforms,
        activeFilters: active,
        toggleFilter: toggle,
        sendTargets: active,
        toggleSendTarget: toggle,
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
