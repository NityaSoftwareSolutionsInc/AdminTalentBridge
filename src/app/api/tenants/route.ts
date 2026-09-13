import { NextResponse } from "next/server";
import { getPlatformSession } from "@/lib/auth";
import { createTenant, listTenants, setTenantEnabled, setTenantJnpAllowed } from "@/lib/tenants";

export async function GET() {
  const session = await getPlatformSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const tenants = await listTenants();
  return NextResponse.json({ tenants });
}

export async function POST(req: Request) {
  const session = await getPlatformSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json()) as { name?: string; jnpAllowed?: boolean };
  try {
    const tenant = await createTenant(String(body.name || ""), session.platformAdminId, Boolean(body.jnpAllowed));
    return NextResponse.json({ tenant });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 400 });
  }
}

export async function PATCH(req: Request) {
  const session = await getPlatformSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json()) as { tenantId?: string; enabled?: boolean; jnpAllowed?: boolean };
  if (!body.tenantId) {
    return NextResponse.json({ error: "tenantId is required" }, { status: 400 });
  }
  try {
    if (typeof body.jnpAllowed === "boolean") {
      const tenant = await setTenantJnpAllowed(body.tenantId, body.jnpAllowed, session.platformAdminId);
      return NextResponse.json({ tenant });
    }
    if (typeof body.enabled !== "boolean") {
      return NextResponse.json({ error: "enabled or jnpAllowed is required" }, { status: 400 });
    }
    const tenant = await setTenantEnabled(body.tenantId, body.enabled, session.platformAdminId);
    return NextResponse.json({ tenant });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 400 });
  }
}
