interface Settings {
  twitchClientId: string;
  twitchClientSecretEnc: string;
  kickClientId: string;
  kickClientSecretEnc: string;
  youtubeClientId: string;
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
//   1. NEXT_PUBLIC_BASE_URL, if it's a real (non-localhost) value — for custom
//      domains you want to pin. (It's inlined at build; a localhost value is
//      ignored so a stray/leftover setting can't drag us back to localhost.)
//   2. The HOST THE USER ACTUALLY HIT — x-forwarded-host / host from the request
//      (Vercel sets these to the real public domain). This is what makes the
//      OAuth redirect_uri always match the domain the login started on, with
//      zero env config, across previews + custom domains. Safe because OAuth
//      only allows redirect_uris registered on the app anyway.
//   3. VERCEL_PROJECT_PRODUCTION_URL (Vercel runtime), then localhost.
async function resolveBaseUrl(): Promise<string> {
  const explicit = process.env.NEXT_PUBLIC_BASE_URL;
  if (explicit && !explicit.includes("localhost")) return normalizeBaseUrl(explicit);

  try {
    const { headers } = await import("next/headers");
    const h = await headers();
    const host = h.get("x-forwarded-host") || h.get("host");
    if (host) {
      const proto = h.get("x-forwarded-proto") || (host.includes("localhost") ? "http" : "https");
      return normalizeBaseUrl(`${proto}://${host}`);
    }
  } catch {
    /* not inside a request (e.g. build) — fall through */
  }

  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (vercel) return normalizeBaseUrl(`https://${vercel}`);
  return "http://localhost:3000";
}

export async function getSettings(): Promise<Settings> {
  return {
    twitchClientId: process.env.TWITCH_CLIENT_ID ?? "",
    twitchClientSecretEnc: "",
    kickClientId: process.env.KICK_CLIENT_ID ?? "",
    kickClientSecretEnc: "",
    youtubeClientId: process.env.YOUTUBE_CLIENT_ID ?? "",
    baseUrl: await resolveBaseUrl(),
  };
}

export async function getBaseUrl(): Promise<string> {
  return resolveBaseUrl();
}
