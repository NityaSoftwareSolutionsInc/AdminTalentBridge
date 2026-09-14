import { NextResponse } from "next/server";
import { getPlatformSession } from "@/lib/auth";
import { listPlatformAudit } from "@/lib/audit";
import { assertCanViewAudit, forbiddenResponse } from "@/lib/platform-rbac";
import { listOwnedTenantIds } from "@/lib/tenants";

export async function GET(req: Request) {
  const session = await getPlatformSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    assertCanViewAudit(session);
    const { searchParams } = new URL(req.url);
    const requestedTenantId = searchParams.get("tenantId") || undefined;
    const owned = session.role === "manager" ? await listOwnedTenantIds(session.platformAdminId) : null;
    if (owned && requestedTenantId && !owned.includes(requestedTenantId)) {
      return NextResponse.json({ events: [] });
    }

    const events = await listPlatformAudit({
      limit: Number(searchParams.get("limit") || 150),
      action: searchParams.get("action") || undefined,
      tenantId: requestedTenantId,
      actorId: searchParams.get("actorId") || undefined,
      q: searchParams.get("q") || undefined,
      from: searchParams.get("from") || undefined,
      to: searchParams.get("to") || undefined,
    });

    const filtered = owned
      ? events.filter((e) => e.actorId === session.platformAdminId || (e.tenantId && owned.includes(e.tenantId)))
      : events;

    return NextResponse.json({ events: filtered });
  } catch (e) {
    const forbidden = forbiddenResponse(e);
    if (forbidden) return NextResponse.json({ error: forbidden.error }, { status: forbidden.status });
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 400 });
  }
}
