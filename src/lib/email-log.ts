import { prisma } from "./db";

export async function logPlatformEmail(input: {
  kind: string;
  toEmail: string;
  subject: string;
  status: "sent" | "stubbed" | "failed";
  providerId?: string;
  error?: string;
  tenantId?: string | null;
  actorId?: string | null;
  relatedUserId?: string | null;
  previewUrl?: string;
}) {
  return prisma.platformEmailLog.create({
    data: {
      kind: input.kind,
      toEmail: input.toEmail,
      subject: input.subject,
      status: input.status,
      providerId: input.providerId || "",
      error: input.error || "",
      tenantId: input.tenantId || null,
      actorId: input.actorId || null,
      relatedUserId: input.relatedUserId || null,
      previewUrl: input.previewUrl || "",
    },
  });
}

export async function listPlatformEmailLogs(input?: {
  status?: string;
  kind?: string;
  q?: string;
  limit?: number;
}) {
  const limit = Math.min(Math.max(input?.limit || 100, 1), 300);
  const where: Record<string, unknown> = {};
  if (input?.status) where.status = input.status;
  if (input?.kind) where.kind = input.kind;
  if (input?.q?.trim()) {
    const q = input.q.trim();
    where.OR = [
      { toEmail: { contains: q, mode: "insensitive" } },
      { subject: { contains: q, mode: "insensitive" } },
    ];
  }

  const rows = await prisma.platformEmailLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  const tenantIds = [...new Set(rows.map((r) => r.tenantId).filter(Boolean))] as string[];
  const tenants = tenantIds.length
    ? await prisma.tenant.findMany({ where: { id: { in: tenantIds } }, select: { id: true, name: true } })
    : [];
  const tenantMap = new Map(tenants.map((t) => [t.id, t.name]));

  return rows.map((r) => ({
    id: r.id,
    kind: r.kind,
    toEmail: r.toEmail,
    subject: r.subject,
    status: r.status,
    providerId: r.providerId,
    error: r.error,
    tenantId: r.tenantId,
    tenantName: r.tenantId ? tenantMap.get(r.tenantId) || null : null,
    actorId: r.actorId,
    relatedUserId: r.relatedUserId,
    previewUrl: r.previewUrl,
    createdAt: r.createdAt.toISOString(),
  }));
}
