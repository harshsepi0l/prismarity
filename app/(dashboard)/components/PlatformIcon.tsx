import type { Platform } from "../chat/types";

// Brand glyphs (24x24, fill currentColor by default).
const PATHS: Record<Platform, string> = {
  twitch:
    "M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714Z",
  youtube:
    "M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z",
  kick: "M1.333 0h8v5.333H12V2.667h2.667V0h8v8H20v2.667h-2.667v2.666H20V16h2.667v8h-8v-2.667H12v-2.666H9.333V24h-8Z",
};

export const PLATFORM_COLOR: Record<Platform, string> = {
  twitch: "#A66CFF",
  youtube: "#FF5C5C",
  kick: "#5BE37D",
};

interface PlatformIconProps {
  platform: Platform;
  size?: number;
  color?: string;
}

export function PlatformIcon({ platform, size = 14, color }: PlatformIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={color ?? PLATFORM_COLOR[platform]}
      aria-hidden
      style={{ flex: "none" }}
    >
      <path d={PATHS[platform]} />
    </svg>
  );
}
