import { NextResponse } from "next/server";
import { getPlatformSession } from "@/lib/auth";
import { listPlatformAudit } from "@/lib/audit";

export async function GET(req: Request) {
  const session = await getPlatformSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const events = await listPlatformAudit({
    limit: Number(searchParams.get("limit") || 150),
    action: searchParams.get("action") || undefined,
    tenantId: searchParams.get("tenantId") || undefined,
    actorId: searchParams.get("actorId") || undefined,
    q: searchParams.get("q") || undefined,
    from: searchParams.get("from") || undefined,
    to: searchParams.get("to") || undefined,
  });
  return NextResponse.json({ events });
}
