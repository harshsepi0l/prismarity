// Client-only localStorage keys that belong to the logged-in session — the
// channels you're watching and your per-session chat preferences. These are
// cleared on full logout so one account's state doesn't linger for the next.
// Cosmetic layout prefs (nav/panel width & mode, split ratio) are intentionally
// NOT included — they're device preferences, not session data.
const SESSION_SCOPED_KEYS = [
  "prismarity:watched-channels",
  "prismarity:read-platforms",
  "prismarity:send-platforms",
  "prismarity:beacon-mode",
  "prismarity:mod-toggles",
];

// Wipe session-scoped storage. Call on full logout (last platform disconnected).
export function clearSessionScopedStorage(): void {
  if (typeof window === "undefined") return;
  for (const key of SESSION_SCOPED_KEYS) {
    try {
      localStorage.removeItem(key);
    } catch {
      /* storage may be unavailable (private mode) — ignore */
    }
  }
}
