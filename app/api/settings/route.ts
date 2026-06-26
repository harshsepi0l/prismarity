import { NextResponse } from "next/server";
import { getSettings, writeSettings } from "@/lib/settings/store";

export const runtime = "nodejs";

export async function GET() {
  const s = await getSettings();
  return NextResponse.json({
    baseUrl: s.baseUrl || "http://localhost:3000",
  });
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_json" }, { status: 400 });
  }

  const b = body as Record<string, unknown>;
  const baseUrl = typeof b.baseUrl === "string" ? b.baseUrl.trim().replace(/\/$/, "") : undefined;

  if (baseUrl !== undefined && baseUrl && !/^https?:\/\/\S+/.test(baseUrl)) {
    return NextResponse.json({ error: "invalid_base_url" }, { status: 400 });
  }

  const current = await getSettings();
  await writeSettings({ ...current, ...(baseUrl !== undefined ? { baseUrl } : {}) });
  return NextResponse.json({ ok: true });
}
