// Minimal Upstash Redis client over its REST API (plain fetch — no SDK, works on
// Node and Edge). This is the ONLY shared server state Prismarity keeps: the
// beacon, which is inherently cross-device (a browser extension writes the active
// channel; the dashboard reads it) so it can't live in a cookie.
//
// No-ops safely when UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN aren't set
// — local dev and any deploy that doesn't use the beacon run fine without a KV;
// the beacon just stays inert (see lib/beacon.ts).
const REST_URL = process.env.UPSTASH_REDIS_REST_URL;
const REST_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

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
