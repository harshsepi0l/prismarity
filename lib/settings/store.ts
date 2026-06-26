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
  baseUrl: "",
};

const DATA_DIR = path.join(process.cwd(), ".data");
const FILE = path.join(DATA_DIR, "settings.json");

const CACHE_TTL = 5 * 60_000;
let _cache: Settings | null = null;
let _cacheAt = 0;

async function read(): Promise<Settings> {
  try {
    const raw = JSON.parse(await fs.readFile(FILE, "utf8")) as Partial<Settings>;
    return { ...DEFAULTS, ...raw };
  } catch {
    return { ...DEFAULTS };
  }
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
