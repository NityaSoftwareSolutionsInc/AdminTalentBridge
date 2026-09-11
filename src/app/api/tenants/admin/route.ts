import { NextResponse } from "next/server";
import { getPlatformSession } from "@/lib/auth";
import { createFirstTenantAdmin, resendFirstAdminInvite } from "@/lib/tenants";

export async function POST(req: Request) {
  const session = await getPlatformSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json()) as {
    tenantId?: string;
    email?: string;
    name?: string;
    resend?: boolean;
    userId?: string;
  };

  try {
    if (body.resend) {
      if (!body.tenantId || !body.userId) {
        return NextResponse.json({ error: "tenantId and userId are required to resend" }, { status: 400 });
      }
      const result = await resendFirstAdminInvite({
        tenantId: body.tenantId,
        userId: body.userId,
        actorId: session.platformAdminId,
        actorName: session.name,
      });
      return NextResponse.json(result);
    }

    const result = await createFirstTenantAdmin({
      tenantId: String(body.tenantId || ""),
      email: String(body.email || ""),
      name: String(body.name || ""),
      actorId: session.platformAdminId,
      actorName: session.name,
    });
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 400 });
  }
}
