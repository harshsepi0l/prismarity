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

// The public origin used to build OAuth redirect URLs. Resolution order:
//   1. NEXT_PUBLIC_BASE_URL — explicit, for custom domains. NOTE: NEXT_PUBLIC_*
//      is INLINED AT BUILD TIME, so it only takes effect if it was set when
//      Vercel built (and a cache-reusing redeploy won't re-bake it).
//   2. VERCEL_PROJECT_PRODUCTION_URL — Vercel injects this at RUNTIME (the stable
//      production domain, no scheme), so the deploy "just works" on *.vercel.app
//      without setting anything, and it's immune to the build-time-inlining trap.
//   3. localhost, for local dev.
// Never derive this from req.url: behind a proxy that carries the internal
// host:port, which would leak into Location headers.
function resolveBaseUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_BASE_URL;
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  const raw = explicit || (vercel ? `https://${vercel}` : "") || "http://localhost:3000";
  return normalizeBaseUrl(raw);
}

export async function getSettings(): Promise<Settings> {
  return {
    twitchClientId: process.env.TWITCH_CLIENT_ID ?? "",
    twitchClientSecretEnc: "",
    kickClientId: process.env.KICK_CLIENT_ID ?? "",
    kickClientSecretEnc: "",
    baseUrl: resolveBaseUrl(),
  };
}

export async function getBaseUrl(): Promise<string> {
  return resolveBaseUrl();
}
