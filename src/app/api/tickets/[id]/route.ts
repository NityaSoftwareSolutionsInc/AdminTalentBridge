import { NextResponse } from "next/server";
import { getPlatformSession } from "@/lib/auth";
import { getPlatformTicket, replyToPlatformTicket } from "@/lib/support-tickets";
import { assertCanMutateTickets, assertCanViewTickets, canMutateTickets, forbiddenResponse } from "@/lib/platform-rbac";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const session = await getPlatformSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    assertCanViewTickets(session);
    const { id } = await ctx.params;
    const ticket = await getPlatformTicket(session, id);
    return NextResponse.json({ ticket, canMutate: canMutateTickets(session) });
  } catch (e) {
    const forbidden = forbiddenResponse(e);
    if (forbidden) return NextResponse.json({ error: forbidden.error }, { status: forbidden.status });
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 404 });
  }
}

export async function POST(req: Request, ctx: Ctx) {
  const session = await getPlatformSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    assertCanMutateTickets(session);
    const { id } = await ctx.params;
    const body = (await req.json()) as {
      body?: string;
      status?: string;
      assignedToId?: string | null;
      priority?: string;
    };
    const result = await replyToPlatformTicket(session, id, body);
    return NextResponse.json(result);
  } catch (e) {
    const forbidden = forbiddenResponse(e);
    if (forbidden) return NextResponse.json({ error: forbidden.error }, { status: forbidden.status });
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 400 });
  }
}
