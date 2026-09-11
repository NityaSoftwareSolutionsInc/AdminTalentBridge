import { prisma } from "./db";

export async function platformAudit(input: {
  actorId: string;
  action: string;
  entityType: string;
  entityId: string;
  tenantId?: string | null;
  before?: unknown;
  after?: unknown;
}) {
  await prisma.platformAuditEvent.create({
    data: {
      actorId: input.actorId,
      tenantId: input.tenantId || null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      before: input.before ? JSON.stringify(input.before) : "",
      after: input.after ? JSON.stringify(input.after) : "",
    },
  });
}

export async function listPlatformAudit(limit = 100) {
  const rows = await prisma.platformAuditEvent.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  const actorIds = [...new Set(rows.map((r) => r.actorId))];
  const tenantIds = [...new Set(rows.map((r) => r.tenantId).filter(Boolean))] as string[];

  const [actors, tenants] = await Promise.all([
    actorIds.length
      ? prisma.platformAdmin.findMany({
          where: { id: { in: actorIds } },
          select: { id: true, name: true, email: true },
        })
      : Promise.resolve([]),
    tenantIds.length
      ? prisma.tenant.findMany({
          where: { id: { in: tenantIds } },
          select: { id: true, name: true },
        })
      : Promise.resolve([]),
  ]);

  const actorMap = new Map(actors.map((a) => [a.id, a]));
  const tenantMap = new Map(tenants.map((t) => [t.id, t.name]));

  return rows.map((r) => {
    const actor = actorMap.get(r.actorId);
    return {
      id: r.id,
      action: r.action,
      entityType: r.entityType,
      entityId: r.entityId,
      tenantId: r.tenantId,
      tenantName: r.tenantId ? tenantMap.get(r.tenantId) || null : null,
      actorId: r.actorId,
      actorName: actor?.name || "Unknown",
      actorEmail: actor?.email || "",
      before: r.before,
      after: r.after,
      createdAt: r.createdAt.toISOString(),
    };
  });
}
