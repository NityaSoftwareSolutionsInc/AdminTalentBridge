import { NextResponse } from "next/server";
import { getPlatformSession } from "@/lib/auth";
import { getTenantDetail } from "@/lib/tenants";
import { canMutateTenant, canSupportAccess } from "@/lib/platform-rbac";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const session = await getPlatformSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { id } = await ctx.params;
    const tenant = await getTenantDetail(id);
    return NextResponse.json({
      tenant: {
        ...tenant,
        canMutate: canMutateTenant(session, tenant.createdById),
        canSupportAccess: canSupportAccess(session),
      },
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 404 });
  }
}
