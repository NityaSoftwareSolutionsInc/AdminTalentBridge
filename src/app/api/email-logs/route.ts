import { NextResponse } from "next/server";
import { getPlatformSession } from "@/lib/auth";
import { listPlatformEmailLogs } from "@/lib/email-log";

export async function GET(req: Request) {
  const session = await getPlatformSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const logs = await listPlatformEmailLogs({
    status: searchParams.get("status") || undefined,
    kind: searchParams.get("kind") || undefined,
    q: searchParams.get("q") || undefined,
    limit: Number(searchParams.get("limit") || 100),
  });
  return NextResponse.json({ logs });
}
