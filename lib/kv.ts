// Minimal Upstash Redis client over its REST API (plain fetch — no SDK, works on
// Node and Edge). This is the ONLY shared server state Prismarity keeps: the
// beacon, which is inherently cross-device (a browser extension writes the active
// channel; the dashboard reads it) so it can't live in a cookie.
//
// No-ops safely when UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN aren't set
// — local dev and any deploy that doesn't use the beacon run fine without a KV;
// the beacon just stays inert (see lib/beacon.ts).
// Find an env var by SUFFIX — the Vercel/Upstash integration may prefix the
// standard names (e.g. UPSTASH_REDIS_REST_KV_REST_API_URL), so match on the tail
// rather than the exact key. Suffixes are tried in order of preference.
function envBySuffix(...suffixes: string[]): string | undefined {
  const entries = Object.entries(process.env);
  for (const suffix of suffixes) {
    const hit = entries.find(([k, v]) => !!v && k.endsWith(suffix));
    if (hit) return hit[1];
  }
  return undefined;
}

// Needs the REST endpoint + a read-WRITE token (the beacon writes state). The
// read-only token (…READ_ONLY_TOKEN) is deliberately not matched by the suffixes.
const REST_URL = envBySuffix("UPSTASH_REDIS_REST_URL", "KV_REST_API_URL");
const REST_TOKEN = envBySuffix("UPSTASH_REDIS_REST_TOKEN", "KV_REST_API_TOKEN");

export const kvEnabled = !!(REST_URL && REST_TOKEN);

// Upstash accepts a command as a JSON array in the POST body: ["SET","k","v",...].
async function command(args: (string | number)[]): Promise<unknown> {
  if (!kvEnabled) return null;
  try {
    const res = await fetch(REST_URL!, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${REST_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(args),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { result?: unknown };
    return json.result ?? null;
  } catch {
    return null;
  }
}

export async function kvGet(key: string): Promise<string | null> {
  const result = await command(["GET", key]);
  return typeof result === "string" ? result : null;
}

export async function kvSet(key: string, value: string, ttlSeconds?: number): Promise<void> {
  await command(ttlSeconds ? ["SET", key, value, "EX", ttlSeconds] : ["SET", key, value]);
}

export async function kvDel(key: string): Promise<void> {
  await command(["DEL", key]);
}
