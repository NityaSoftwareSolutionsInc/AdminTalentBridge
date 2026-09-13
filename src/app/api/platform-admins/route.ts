import { NextResponse } from "next/server";
import { getPlatformSession } from "@/lib/auth";
import {
  invitePlatformAdmin,
  issuePlatformAdminInvite,
  listPlatformAdmins,
  listPlatformLoginEvents,
  setPlatformAdminEnabled,
} from "@/lib/platform-admins";

export async function GET() {
  const session = await getPlatformSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const [admins, loginEvents] = await Promise.all([listPlatformAdmins(), listPlatformLoginEvents(40)]);
  return NextResponse.json({ admins, loginEvents });
}

export async function POST(req: Request) {
  const session = await getPlatformSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json()) as {
    name?: string;
    email?: string;
    adminId?: string;
    resend?: boolean;
  };

  try {
    if (body.resend && body.adminId) {
      const invite = await issuePlatformAdminInvite({
        adminId: body.adminId,
        actorId: session.platformAdminId,
        actorName: session.name,
      });
      return NextResponse.json({ invite });
    }
    const result = await invitePlatformAdmin({
      name: String(body.name || ""),
      email: String(body.email || ""),
      actorId: session.platformAdminId,
      actorName: session.name,
    });
    return NextResponse.json(result);
  } catch (e) {
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
    const admin = await setPlatformAdminEnabled(body.adminId, body.enabled, session.platformAdminId);
    return NextResponse.json({ admin });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 400 });
  }
}
