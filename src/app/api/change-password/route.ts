import { NextResponse } from "next/server";
import { getPlatformSession } from "@/lib/auth";
import { changeOwnPlatformPassword } from "@/lib/platform-admins";

export async function POST(req: Request) {
  const session = await getPlatformSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = (await req.json()) as { currentPassword?: string; password?: string };
  try {
    await changeOwnPlatformPassword(
      session.platformAdminId,
      String(body.currentPassword || ""),
      String(body.password || ""),
    );
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 400 });
  }
}
