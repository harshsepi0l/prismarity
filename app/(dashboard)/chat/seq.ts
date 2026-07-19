// A process-wide monotonic counter used to order the merged Twitch + Kick feed
// by the moment each message ARRIVED in the browser, rather than by the
// platform-supplied timestamps (which live on different clocks — Twitch stamps
// client-receive time, Kick sends its own server `created_at`). Sorting those
// two clocks against each other made messages jump into the past and interleave
// wrongly. A single local sequence gives one consistent total order: new
// messages only ever append at the bottom, never reorder above existing ones.
let counter = 0;

export function nextSeq(): number {
  counter += 1;
  return counter;
}
