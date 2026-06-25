function Sparkle({
  x,
  y,
  r,
  color = "#E8EBF2",
  o = 1,
}: {
  x: number;
  y: number;
  r: number;
  color?: string;
  o?: number;
}) {
  const c = r * 0.28;

  const d = `
    M0,${-r}
    C0,${-c} ${c},0 ${r},0
    C${c},0 0,${c} 0,${r}
    C0,${c} ${-c},0 ${-r},0
    C${-c},0 0,${-c} 0,${-r}
    Z
  `;

  return (
    <path
      d={d}
      transform={`translate(${x} ${y})`}
      fill={color}
      opacity={o}
    />
  );
}

export function Logo() {
  return (
    <svg
      width="52"
      height="30"
      viewBox="0 0 64 30"
      fill="none"
      aria-hidden
      style={{ flex: "none", overflow: "visible" }}
    >

      {/* incoming light stream */}
      <Sparkle x={2} y={15} r={0.8} o={0.25} />
      <Sparkle x={6} y={15} r={1.1} o={0.4} />
      <Sparkle x={10} y={14} r={1.5} o={0.6} />
      <Sparkle x={14} y={15} r={2} o={0.8} />
      <Sparkle x={18} y={15} r={2.8} o={1} />


      {/* prism */}
      <path
        d="M27 4 L14.3 26 L39.7 26 Z"
        fill="#171B26"
        stroke="#3A4252"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />


      {/* spectrum split */}
      <Sparkle x={40} y={15} r={1.3} color="#38BDF8" />

      <Sparkle x={42} y={12} r={1.4} color="#60A5FA" />
      <Sparkle x={42} y={18} r={1.4} color="#22D3EE" />

      <Sparkle x={45} y={10} r={1.5} color="#A855F7" />
      <Sparkle x={45} y={15} r={2.2} color="#F472B6" />
      <Sparkle x={45} y={20} r={1.5} color="#FACC15" />

      <Sparkle x={49} y={8} r={1.1} color="#F97316" />
      <Sparkle x={50} y={12} r={1.3} color="#EF4444" />
      <Sparkle x={50} y={18} r={1.3} color="#EC4899" />
      <Sparkle x={49} y={22} r={1.1} color="#22C55E" />

      <Sparkle x={54} y={15} r={1} color="#E879F9" />

    </svg>
  );
}