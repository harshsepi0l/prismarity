interface Settings {
  twitchClientId: string;
  twitchClientSecretEnc: string;
  kickClientId: string;
  kickClientSecretEnc: string;
  baseUrl: string;
}

// Config is ENV-DRIVEN and read-only. There is no writable settings store — the
// runtime write UI was removed (an unauthenticated write could poison baseUrl →
// open redirect after login), and a serverless host has no persistent filesystem
// anyway. Client IDs / base URL come from env; client secrets are read directly
// from env by the auth layer (never surfaced here).

// Reduce a configured base URL to just its origin (scheme + host + port),
// dropping any stray path — e.g. a mistakenly pasted "/api/auth/twitch/callback"
// suffix — so platform callback URLs are always built correctly.
export function normalizeBaseUrl(base: string): string {
  if (!base) return "";
  try {
    return new URL(base).origin;
  } catch {
    return base.replace(/\/+$/, "");
  }
}

export async function getSettings(): Promise<Settings> {
  return {
    twitchClientId: process.env.TWITCH_CLIENT_ID ?? "",
    twitchClientSecretEnc: "",
    kickClientId: process.env.KICK_CLIENT_ID ?? "",
    kickClientSecretEnc: "",
    baseUrl: normalizeBaseUrl(process.env.NEXT_PUBLIC_BASE_URL ?? ""),
  };
}

// The public origin to build user-facing redirect URLs from. Must NOT be derived
// from the incoming request: behind a proxy/container, req.url carries the
// internal host:port, which then leaks into Location headers.
export async function getBaseUrl(): Promise<string> {
  return normalizeBaseUrl(
    process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"
  );
}
