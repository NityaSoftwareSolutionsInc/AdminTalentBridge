import { NextResponse } from "next/server";
import { getPlatformSession } from "@/lib/auth";
import { createTenant, listTenants, setTenantEnabled } from "@/lib/tenants";

export async function GET() {
  const session = await getPlatformSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const tenants = await listTenants();
  return NextResponse.json({ tenants });
}

export async function POST(req: Request) {
  const session = await getPlatformSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json()) as { name?: string };
  try {
    const tenant = await createTenant(String(body.name || ""), session.platformAdminId);
    return NextResponse.json({ tenant });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 400 });
  }
}

export async function PATCH(req: Request) {
  const session = await getPlatformSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json()) as { tenantId?: string; enabled?: boolean };
  if (!body.tenantId || typeof body.enabled !== "boolean") {
    return NextResponse.json({ error: "tenantId and enabled are required" }, { status: 400 });
  }
  try {
    const tenant = await setTenantEnabled(body.tenantId, body.enabled, session.platformAdminId);
    return NextResponse.json({ tenant });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 400 });
  }
}
