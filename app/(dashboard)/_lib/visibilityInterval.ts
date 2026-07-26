// A setInterval that pauses while the tab is backgrounded and resumes when it's
// shown again. On the browser M4/laptop, dozens of these polls (channel status,
// stats, GQL banner, co-stream detection…) otherwise keep firing at full cadence
// in hidden tabs, which is a large share of the app's idle CPU/battery cost.
//
// Behaviour:
//   • visible  → runs `fn` every `ms`, exactly like setInterval.
//   • hidden   → the timer is cleared; `fn` does not run.
//   • re-shown → `fn` fires once immediately (so stale data refreshes on focus),
//                then the interval resumes.
//
// The caller's own initial `fn()` (the load-on-mount most effects do) is left
// untouched — this only governs the recurring tick. Returns a stop() that clears
// the timer and removes the visibility listener; call it from effect cleanup in
// place of clearInterval.
export function visibilityInterval(fn: () => void, ms: number): () => void {
  // SSR / non-DOM guard — behave like a plain interval if there's no document.
  if (typeof document === "undefined") {
    const id = setInterval(fn, ms);
    return () => clearInterval(id);
  }

  let id: ReturnType<typeof setInterval> | null = null;

  const start = () => {
    if (id == null) id = setInterval(fn, ms);
  };
  const stop = () => {
    if (id != null) {
      clearInterval(id);
      id = null;
    }
  };
  const onVisibilityChange = () => {
    if (document.visibilityState === "visible") {
      fn(); // refresh immediately on focus
      start();
    } else {
      stop();
    }
  };

  if (document.visibilityState === "visible") start();
  document.addEventListener("visibilitychange", onVisibilityChange);

  return () => {
    stop();
    document.removeEventListener("visibilitychange", onVisibilityChange);
  };
}
