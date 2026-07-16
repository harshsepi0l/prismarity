import { promises as fs } from "fs";
import path from "path";

interface Settings {
  twitchClientId: string;
  twitchClientSecretEnc: string;
  kickClientId: string;
  kickClientSecretEnc: string;
  baseUrl: string;
}

const DEFAULTS: Settings = {
  twitchClientId: "",
  twitchClientSecretEnc: "",
  kickClientId: "",
  kickClientSecretEnc: "",
  baseUrl: process.env.NEXT_PUBLIC_BASE_URL ?? "",
};

const DATA_DIR = path.join(process.cwd(), ".data");
const FILE = path.join(DATA_DIR, "settings.json");
const CACHE_TTL = 5 * 60_000;

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

let _cache: Settings | null = null;
let _cacheAt = 0;

async function read(): Promise<Settings> {
  try {
    const raw = JSON.parse(await fs.readFile(FILE, "utf8")) as Partial<Settings>;
    return {
      ...DEFAULTS,
      ...raw,
      // Always prefer the env var for baseUrl — file-based value may be stale
      // or simply absent on Azure's ephemeral filesystem.
      baseUrl: normalizeBaseUrl(process.env.NEXT_PUBLIC_BASE_URL ?? raw.baseUrl ?? DEFAULTS.baseUrl),
    };
  } catch {
    return { ...DEFAULTS };
  }
}

// The public origin to build user-facing redirect URLs from. Must NOT be
// derived from the incoming request: behind a proxy/container (e.g. Azure)
// req.url carries the internal host:port, which then leaks into Location headers.
export async function getBaseUrl(): Promise<string> {
  const s = await getSettings();
  return normalizeBaseUrl(
    s.baseUrl || process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"
  );
}

export async function getSettings(): Promise<Settings> {
  if (_cache && Date.now() - _cacheAt < CACHE_TTL) return _cache;
  _cache = await read();
  _cacheAt = Date.now();
  return _cache;
}

export async function writeSettings(s: Settings): Promise<void> {
  _cache = null;
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(s, null, 2), "utf8");
}