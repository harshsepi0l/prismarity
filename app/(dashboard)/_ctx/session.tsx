"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { Platform } from "../types";
import type { Role } from "@/lib/auth/types";

// The viewer's role for the current session.
export type Mode = "creator" | "viewer" | "moderator";

const MODE_KEY = "prismarity:mode";
const READ_KEY = "prismarity:read-platforms";
const SEND_KEY = "prismarity:send-platforms";
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
  // Platforms the user has actually connected (logged into).
  connectedPlatforms: Set<Platform>;
  // Read set — platforms whose chat is shown in the feed. Controlled at the feed
  // itself (the read bar / column headers). Independent of send. Always
  // intersected with connected.
  activeFilters: Set<Platform>;
  toggleRead: (p: Platform) => void;
  // Send set — platforms your outgoing message is delivered to (the composer
  // "Send to" chips). Independent of read: you may post to a platform you aren't
  // watching, or watch one you don't post to.
  sendTargets: Set<Platform>;
  toggleSendTarget: (p: Platform) => void;
}

const SessionContext = createContext<SessionState | null>(null);

interface Selection {
  read: Platform[];
  send: Platform[];
}

export function SessionProvider({
  connectedPlatforms: connectedInput = [],
  children,
}: {
  connectedPlatforms?: Platform[];
  children: React.ReactNode;
}) {
  const [mode, setModeState] = useState<Mode>("creator");
  // Default: read + send everything (both sets full) — carve out read-only per
  // platform via the eye.
  const [sel, setSel] = useState<Selection>({ read: [...ALL], send: [...ALL] });

  const connectedPlatforms = useMemo(
    () => new Set(connectedInput),
    [connectedInput]
  );

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    const m = localStorage.getItem(MODE_KEY);
    if (isMode(m)) setModeState(m);

    try {
      const read = localStorage.getItem(READ_KEY);
      const send = localStorage.getItem(SEND_KEY);
      if (read || send) {
        const r = read ? sanitize(JSON.parse(read)) : [...ALL];
        // Read and send are independent sets.
        const s = send ? sanitize(JSON.parse(send)) : [...ALL];
        setSel({ read: r, send: s });
      }
    } catch {
      /* ignore malformed storage */
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  const setMode = useCallback((m: Mode) => {
    setModeState(m);
    localStorage.setItem(MODE_KEY, m);
  }, []);

  const persist = (next: Selection) => {
    localStorage.setItem(READ_KEY, JSON.stringify(next.read));
    localStorage.setItem(SEND_KEY, JSON.stringify(next.send));
  };

  // Read toggle (feed): show/hide this platform's chat. Independent of send.
  const toggleRead = useCallback(
    (p: Platform) => {
      if (!connectedPlatforms.has(p)) return;
      setSel((prev) => {
        const has = prev.read.includes(p);
        const next: Selection = {
          ...prev,
          read: has ? prev.read.filter((x) => x !== p) : [...prev.read, p],
        };
        persist(next);
        return next;
      });
    },
    [connectedPlatforms]
  );

  // Send toggle (composer): arm/disarm this platform as a delivery target.
  // Independent of read.
  const toggleSendTarget = useCallback(
    (p: Platform) => {
      if (!connectedPlatforms.has(p)) return;
      setSel((prev) => {
        const has = prev.send.includes(p);
        const next: Selection = {
          ...prev,
          send: has ? prev.send.filter((x) => x !== p) : [...prev.send, p],
        };
        persist(next);
        return next;
      });
    },
    [connectedPlatforms]
  );

  // Both sets only ever include connected platforms.
  const activeFilters = useMemo(
    () => new Set(sel.read.filter((p) => connectedPlatforms.has(p))),
    [sel.read, connectedPlatforms]
  );
  const sendTargets = useMemo(
    () => new Set(sel.send.filter((p) => connectedPlatforms.has(p))),
    [sel.send, connectedPlatforms]
  );

  return (
    <SessionContext.Provider
      value={{
        mode,
        setMode,
        connectedPlatforms,
        activeFilters,
        toggleRead,
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
