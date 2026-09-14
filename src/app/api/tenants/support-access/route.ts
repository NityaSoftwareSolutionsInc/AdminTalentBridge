import { NextResponse } from "next/server";
import { getPlatformSession } from "@/lib/auth";
import { createSupportAccessUrl } from "@/lib/support-access";
import { assertCanSupportAccess, forbiddenResponse } from "@/lib/platform-rbac";

export async function POST(req: Request) {
  const session = await getPlatformSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.mustChangePassword) {
    return NextResponse.json({ error: "Change your password before using support access" }, { status: 403 });
  }

  const body = (await req.json()) as { tenantId?: string; userId?: string };
  try {
    assertCanSupportAccess(session);
    const result = await createSupportAccessUrl({
      platformAdminId: session.platformAdminId,
      tenantId: String(body.tenantId || ""),
      userId: body.userId,
    });
    return NextResponse.json(result);
  } catch (e) {
    const forbidden = forbiddenResponse(e);
    if (forbidden) return NextResponse.json({ error: forbidden.error }, { status: forbidden.status });
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 400 });
  }
}
