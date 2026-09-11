import { NextResponse } from "next/server";
import { getPlatformSession } from "@/lib/auth";
import { listPlatformAudit } from "@/lib/audit";

export async function GET() {
  const session = await getPlatformSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const events = await listPlatformAudit(120);
  return NextResponse.json({ events });
}
