import { NextResponse } from "next/server";
import { getPlatformSession } from "@/lib/auth";
import { createTenant, listTenants, updateTenant } from "@/lib/tenants";

export async function GET() {
  const session = await getPlatformSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const tenants = await listTenants();
  return NextResponse.json({ tenants });
}

export async function POST(req: Request) {
  const session = await getPlatformSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json()) as {
    name?: string;
    jnpAllowed?: boolean;
    outlookAllowed?: boolean;
    viotalkAllowed?: boolean;
    adminName?: string;
    adminEmail?: string;
    legalName?: string;
    billingContact?: string;
    region?: string;
    notes?: string;
    accountOwner?: string;
  };
  try {
    const adminName = String(body.adminName || "").trim();
    const adminEmail = String(body.adminEmail || "").trim();
    if (!adminName || !adminEmail) {
      return NextResponse.json(
        {
          error:
            "First Administrator name and email are required. An activation email will be sent — they must activate from that email before signing in.",
        },
        { status: 400 },
      );
    }
    const tenant = await createTenant(
      String(body.name || ""),
      session.platformAdminId,
      Boolean(body.jnpAllowed),
      { name: adminName, email: adminEmail, actorName: session.name },
      {
        legalName: body.legalName,
        billingContact: body.billingContact,
        region: body.region,
        notes: body.notes,
        accountOwner: body.accountOwner,
        outlookAllowed: body.outlookAllowed,
        viotalkAllowed: body.viotalkAllowed,
      },
    );
    return NextResponse.json({ tenant });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 400 });
  }
}

export async function PATCH(req: Request) {
  const session = await getPlatformSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json()) as {
    tenantId?: string;
    enabled?: boolean;
    jnpAllowed?: boolean;
    outlookAllowed?: boolean;
    viotalkAllowed?: boolean;
    maintenanceMode?: boolean;
    maintenanceMessage?: string;
    legalName?: string;
    billingContact?: string;
    region?: string;
    notes?: string;
    accountOwner?: string;
  };
  if (!body.tenantId) {
    return NextResponse.json({ error: "tenantId is required" }, { status: 400 });
  }
  try {
    const tenant = await updateTenant(body.tenantId, body, session.platformAdminId);
    return NextResponse.json({ tenant });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 400 });
  }
}
