"use client";

// Beacon signal art — a Wi-Fi style mark (centre dot + two radiating arcs) in
// beacon blue, shared by the top-bar pill and the settings chat section so both
// stay identical. "searching" runs the classic connecting sweep (dot → inner
// arc → outer arc light up bottom-to-top, then reset together); "strong" holds
// the whole mark lit once the chat socket is connected.
const SIGNAL_BLUE = "rgb(56,189,248)";

export function BeaconSignal({
  state,
  size = 16,
}: {
  state: "searching" | "strong";
  size?: number;
}) {
  const part = (n: number) =>
    state === "searching"
      ? { opacity: 0.25, animation: `signal-wifi-${n} 1.4s ease-in-out infinite` }
      : { opacity: 0.95 };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden style={{ flex: "none" }}>
      <path d="M4 9.5a11 11 0 0116 0" stroke={SIGNAL_BLUE} strokeWidth="2" strokeLinecap="round" style={part(3)} />
      <path d="M7.5 13.5a6.5 6.5 0 019 0" stroke={SIGNAL_BLUE} strokeWidth="2" strokeLinecap="round" style={part(2)} />
      <circle cx="12" cy="18" r="2.5" fill={SIGNAL_BLUE} style={part(1)} />
    </svg>
  );
}
