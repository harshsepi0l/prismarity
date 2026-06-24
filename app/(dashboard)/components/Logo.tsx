// Stars stream into the prism from the left and emerge as a single white line —
// many sources, one unified feed.
function Sparkle({ x, y, r, o }: { x: number; y: number; r: number; o: number }) {
  const c = r * 0.28;
  const d = `M0,${-r} C0,${-c} ${c},0 ${r},0 C${c},0 0,${c} 0,${r} C0,${c} ${-c},0 ${-r},0 C${-c},0 0,${-c} 0,${-r} Z`;
  return <path d={d} transform={`translate(${x} ${y})`} fill="#E8EBF2" opacity={o} />;
}

export function Logo() {
  return (
    <svg
      width="42"
      height="26"
      viewBox="0 0 52 30"
      fill="none"
      aria-hidden
      style={{ flex: "none", overflow: "visible" }}
    >
      {/* incoming stars */}
      <Sparkle x={3} y={8} r={1.5} o={0.5} />
      <Sparkle x={8} y={13} r={2.6} o={0.85} />
      <Sparkle x={5} y={21} r={1.9} o={0.65} />
      <Sparkle x={13} y={6} r={1.3} o={0.45} />
      <Sparkle x={14.5} y={16} r={3} o={1} />
      <Sparkle x={11} y={23} r={1.7} o={0.6} />

      {/* prism */}
      <path
        d="M20 4 L20 26 L39 15 Z"
        fill="#171B26"
        stroke="#3A4252"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />

      {/* unified white beam */}
      <path d="M39 15 L50 15" stroke="#E8EBF2" strokeWidth="2.6" strokeLinecap="round" />
    </svg>
  );
}
