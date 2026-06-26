// Kick global (platform-wide) badge images — level badges and other non-channel
// badges. These are NOT channel-specific; they apply across all of Kick.
//
// The Kick v2 API surface for global badges is not officially documented.
// We probe the most likely endpoints and parse defensively. If all fail the
// caller receives an empty map and the UI falls back to styled text chips.

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

export interface KickGlobalBadge {
  type: string;   // e.g. "level"
  label: string;  // e.g. "Level 7"
  imageUrl: string;
}

interface V2BadgeEntry {
  id?: string | number;
  type?: string;
  name?: string;
  label?: string;
  level?: number;
  badge_image?: { src?: string; srcset?: string };
  image?: string;
  image_url?: string;
  src?: string;
}

function extractUrl(e: V2BadgeEntry): string | null {
  return (
    e.badge_image?.src ??
    e.image_url ??
    e.image ??
    e.src ??
    null
  );
}

// Try a candidate URL, return parsed entries or null on any failure.
async function probe(url: string): Promise<V2BadgeEntry[] | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const json = await res.json();
    // Accept array at root, or nested under data/badges/levels/global_badges.
    const arr: unknown =
      Array.isArray(json) ? json :
      Array.isArray(json?.data) ? json.data :
      Array.isArray(json?.badges) ? json.badges :
      Array.isArray(json?.levels) ? json.levels :
      Array.isArray(json?.global_badges) ? json.global_badges :
      null;
    return Array.isArray(arr) ? (arr as V2BadgeEntry[]) : null;
  } catch {
    return null;
  }
}

// Candidate endpoints in order of likelihood. The first one that returns a
// parseable badge array wins; the rest are skipped.
const CANDIDATES = [
  "https://kick.com/api/v2/channels/global-badges",
  "https://kick.com/api/v2/global-badges",
  "https://kick.com/api/internal/badges/global",
  "https://kick.com/api/v2/badges/global",
];

// Fetch all Kick global badges. Returns a map keyed by `${type}:${level}` (for
// level badges, e.g. "level:7") or `${type}:1` for single-version types.
// Returns an empty map on total failure — the UI gracefully degrades.
export async function fetchKickGlobalBadges(): Promise<Record<string, KickGlobalBadge>> {
  const result: Record<string, KickGlobalBadge> = {};

  for (const url of CANDIDATES) {
    const entries = await probe(url);
    if (!entries || entries.length === 0) continue;

    for (const e of entries) {
      const imageUrl = extractUrl(e);
      if (!imageUrl) continue;
      const type = e.type ?? "unknown";
      const level = e.level ?? (typeof e.id === "number" ? e.id : 1);
      const label = e.label ?? e.name ?? `${type} ${level}`;
      result[`${type}:${level}`] = { type, label, imageUrl };
    }

    if (Object.keys(result).length > 0) break; // got something — stop probing
  }

  return result;
}
