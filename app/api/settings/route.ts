import { NextResponse } from "next/server";
import { getSettings } from "@/lib/settings/store";

export const runtime = "nodejs";

// Read-only. `baseUrl` is deploy-time config (NEXT_PUBLIC_BASE_URL) — it must
// NOT be writable over HTTP. An earlier unauthenticated POST here let anyone
// poison the shared baseUrl, which feeds OAuth redirect Location headers, i.e.
// an open-redirect-after-login. There is no admin role to gate a write behind,
// so the write path is removed entirely; a POST now 405s.
export async function GET() {
  const s = await getSettings();
  return NextResponse.json({
    baseUrl: s.baseUrl || "http://localhost:3000",
  });
}
