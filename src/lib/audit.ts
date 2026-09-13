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

export type PlatformAuditFilter = {
  limit?: number;
  action?: string;
  tenantId?: string;
  actorId?: string;
  q?: string;
  from?: string;
  to?: string;
};

export async function listPlatformAudit(filter: PlatformAuditFilter | number = 100) {
  const opts: PlatformAuditFilter = typeof filter === "number" ? { limit: filter } : filter;
  const limit = Math.min(Math.max(opts.limit || 100, 1), 500);

  const where: Record<string, unknown> = {};
  if (opts.action?.trim()) where.action = { contains: opts.action.trim(), mode: "insensitive" };
  if (opts.tenantId) where.tenantId = opts.tenantId;
  if (opts.actorId) where.actorId = opts.actorId;
  if (opts.from || opts.to) {
    where.createdAt = {
      ...(opts.from ? { gte: new Date(opts.from) } : {}),
      ...(opts.to ? { lte: new Date(opts.to) } : {}),
    };
  }

  let rows = await prisma.platformAuditEvent.findMany({
    where,
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

  let mapped = rows.map((r) => {
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

  const q = opts.q?.trim().toLowerCase();
  if (q) {
    mapped = mapped.filter(
      (r) =>
        r.action.toLowerCase().includes(q) ||
        r.actorName.toLowerCase().includes(q) ||
        r.actorEmail.toLowerCase().includes(q) ||
        (r.tenantName || "").toLowerCase().includes(q) ||
        r.entityType.toLowerCase().includes(q),
    );
  }

  return mapped;
}
