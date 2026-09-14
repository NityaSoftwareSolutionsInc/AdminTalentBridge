import { NextResponse } from "next/server";
import { getPlatformSession } from "@/lib/auth";
import {
  invitePlatformAdmin,
  issuePlatformAdminInvite,
  listPlatformAdmins,
  listPlatformLoginEvents,
  setPlatformAdminEnabled,
} from "@/lib/platform-admins";
import { assertCanManagePlatformUsers, forbiddenResponse, parsePlatformRole } from "@/lib/platform-rbac";

export async function GET() {
  const session = await getPlatformSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    assertCanManagePlatformUsers(session);
    const [admins, loginEvents] = await Promise.all([listPlatformAdmins(), listPlatformLoginEvents(40)]);
    return NextResponse.json({ admins, loginEvents });
  } catch (e) {
    const forbidden = forbiddenResponse(e);
    if (forbidden) return NextResponse.json({ error: forbidden.error }, { status: forbidden.status });
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 400 });
  }
}

export async function POST(req: Request) {
  const session = await getPlatformSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json()) as {
    name?: string;
    email?: string;
    adminId?: string;
    resend?: boolean;
    role?: string;
  };

  try {
    assertCanManagePlatformUsers(session);
    if (body.resend && body.adminId) {
      const invite = await issuePlatformAdminInvite({
        adminId: body.adminId,
        actorId: session.platformAdminId,
        actorName: session.name,
      });
      return NextResponse.json({ invite });
    }
    const role = parsePlatformRole(body.role) || "global_admin";
    const result = await invitePlatformAdmin({
      name: String(body.name || ""),
      email: String(body.email || ""),
      role,
      actorId: session.platformAdminId,
      actorName: session.name,
    });
    return NextResponse.json(result);
  } catch (e) {
    const forbidden = forbiddenResponse(e);
    if (forbidden) return NextResponse.json({ error: forbidden.error }, { status: forbidden.status });
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 400 });
  }
}

export async function PATCH(req: Request) {
  const session = await getPlatformSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = (await req.json()) as { adminId?: string; enabled?: boolean };
  if (!body.adminId || typeof body.enabled !== "boolean") {
    return NextResponse.json({ error: "adminId and enabled are required" }, { status: 400 });
  }
  try {
    assertCanManagePlatformUsers(session);
    const admin = await setPlatformAdminEnabled(body.adminId, body.enabled, session.platformAdminId);
    return NextResponse.json({ admin });
  } catch (e) {
    const forbidden = forbiddenResponse(e);
    if (forbidden) return NextResponse.json({ error: forbidden.error }, { status: forbidden.status });
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 400 });
  }
}
