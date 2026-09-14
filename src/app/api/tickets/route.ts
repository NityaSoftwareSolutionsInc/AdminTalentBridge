import { NextResponse } from "next/server";
import { getPlatformSession } from "@/lib/auth";
import { countOpenTickets, listPlatformTickets } from "@/lib/support-tickets";
import { assertCanViewTickets, canMutateTickets, forbiddenResponse } from "@/lib/platform-rbac";

export async function GET(req: Request) {
  const session = await getPlatformSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    assertCanViewTickets(session);
    const { searchParams } = new URL(req.url);
    const [tickets, openCount] = await Promise.all([
      listPlatformTickets(session, {
        status: searchParams.get("status") || undefined,
        q: searchParams.get("q") || undefined,
      }),
      countOpenTickets(session),
    ]);
    return NextResponse.json({
      tickets,
      openCount,
      canMutate: canMutateTickets(session),
    });
  } catch (e) {
    const forbidden = forbiddenResponse(e);
    if (forbidden) return NextResponse.json({ error: forbidden.error }, { status: forbidden.status });
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 400 });
  }
}
