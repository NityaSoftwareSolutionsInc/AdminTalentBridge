import { TbRole } from "@prisma/client";
import { prisma } from "./db";
import { platformAudit } from "./audit";
import { issueTenantAdminInvite } from "./invite";
import { notifyTenantDisabled, notifyTenantEnabled } from "./platform-mail";

function daysAgo(days: number) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

/** Local shape — avoids stale multi-root Prisma client typings in the IDE. */
type TenantRecord = {
  id: string;
  name: string;
  enabled: boolean;
  jnpAllowed: boolean;
  outlookAllowed: boolean;
  viotalkAllowed: boolean;
  maintenanceMode: boolean;
  maintenanceMessage: string;
  legalName: string;
  billingContact: string;
  region: string;
  notes: string;
  accountOwner: string;
  createdAt: Date;
};

type AdminUserRow = {
  id: string;
  name: string;
  email: string;
  inviteSentAt: Date | null;
  passwordSetAt: Date | null;
  passwordHash: string | null;
  lastLoginAt: Date | null;
};

function mapTenantBase(t: TenantRecord) {
  return {
    id: t.id,
    name: t.name,
    enabled: t.enabled,
    jnpAllowed: t.jnpAllowed,
    outlookAllowed: t.outlookAllowed,
    viotalkAllowed: t.viotalkAllowed,
    maintenanceMode: t.maintenanceMode,
    maintenanceMessage: t.maintenanceMessage,
    legalName: t.legalName,
    billingContact: t.billingContact,
    region: t.region,
    notes: t.notes,
    accountOwner: t.accountOwner,
    createdAt: t.createdAt.toISOString(),
  };
}

function asTenantRecord(value: unknown): TenantRecord {
  const t = value as Partial<TenantRecord> & { id: string; name: string; createdAt: Date };
  return {
    id: t.id,
    name: t.name,
    enabled: Boolean(t.enabled),
    jnpAllowed: Boolean(t.jnpAllowed),
    outlookAllowed: t.outlookAllowed !== false,
    viotalkAllowed: t.viotalkAllowed !== false,
    maintenanceMode: Boolean(t.maintenanceMode),
    maintenanceMessage: String(t.maintenanceMessage || ""),
    legalName: String(t.legalName || ""),
    billingContact: String(t.billingContact || ""),
    region: String(t.region || ""),
    notes: String(t.notes || ""),
    accountOwner: String(t.accountOwner || ""),
    createdAt: t.createdAt,
  };
}

export async function listTenants() {
  const since7 = daysAgo(7);
  const since30 = daysAgo(30);

  const rows = (await prisma.tenant.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { users: true, mailboxMaps: true } },
      users: {
        where: { memberships: { some: { role: TbRole.admin } } },
        take: 5,
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          name: true,
          email: true,
          inviteSentAt: true,
          passwordSetAt: true,
          passwordHash: true,
          lastLoginAt: true,
        },
      },
    },
  })) as unknown as Array<
    TenantRecord & {
      _count: { users: number; mailboxMaps: number };
      users: AdminUserRow[];
    }
  >;

  const tenantIds = rows.map((t) => t.id);
  const [active7, active30, recentAudits] = await Promise.all([
    tenantIds.length
      ? prisma.user.groupBy({
          by: ["tenantId"],
          where: { tenantId: { in: tenantIds }, lastLoginAt: { gte: since7 } },
          _count: { _all: true },
        })
      : Promise.resolve([] as Array<{ tenantId: string; _count: { _all: number } }>),
    tenantIds.length
      ? prisma.user.groupBy({
          by: ["tenantId"],
          where: { tenantId: { in: tenantIds }, lastLoginAt: { gte: since30 } },
          _count: { _all: true },
        })
      : Promise.resolve([] as Array<{ tenantId: string; _count: { _all: number } }>),
    tenantIds.length
      ? prisma.platformAuditEvent.findMany({
          where: { tenantId: { in: tenantIds } },
          orderBy: { createdAt: "desc" },
          take: 200,
          select: { tenantId: true, action: true, createdAt: true },
        })
      : Promise.resolve([] as Array<{ tenantId: string | null; action: string; createdAt: Date }>),
  ]);

  const map7 = new Map(active7.map((r) => [r.tenantId, r._count._all]));
  const map30 = new Map(active30.map((r) => [r.tenantId, r._count._all]));
  const auditMap = new Map<string, { action: string; createdAt: Date }>();
  for (const a of recentAudits) {
    if (!a.tenantId || auditMap.has(a.tenantId)) continue;
    auditMap.set(a.tenantId, { action: a.action, createdAt: a.createdAt });
  }

  return rows.map((t) => {
    const pendingAdmins = t.users.filter((u) => !u.passwordHash);
    const pendingInviteDates = pendingAdmins
      .map((u) => u.inviteSentAt)
      .filter((d): d is Date => d != null);
    const oldestPending = pendingInviteDates.sort((a, b) => +a - +b)[0] ?? null;
    const loginDates = t.users.map((u) => u.lastLoginAt).filter((d): d is Date => d != null);
    const lastUserLogin = loginDates.sort((a, b) => +b - +a)[0] ?? null;
    const lastAudit = auditMap.get(t.id);

    return {
      ...mapTenantBase(t),
      userCount: t._count.users,
      mailboxMappedCount: t._count.mailboxMaps,
      activeUsers7d: map7.get(t.id) || 0,
      activeUsers30d: map30.get(t.id) || 0,
      lastUserLoginAt: lastUserLogin ? lastUserLogin.toISOString() : null,
      lastPlatformAuditAt: lastAudit?.createdAt.toISOString() ?? null,
      lastPlatformAuditAction: lastAudit?.action ?? null,
      pendingInviteCount: pendingAdmins.length,
      oldestPendingInviteAt: oldestPending ? oldestPending.toISOString() : null,
      invitePendingAgingDays: oldestPending
        ? Math.floor((Date.now() - +oldestPending) / (24 * 60 * 60 * 1000))
        : null,
      admins: t.users.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        inviteSentAt: u.inviteSentAt?.toISOString() ?? null,
        passwordSet: Boolean(u.passwordHash),
        lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
      })),
    };
  });
}

export async function getTenantDetail(tenantId: string) {
  const tenants = await listTenants();
  const tenant = tenants.find((row) => row.id === tenantId);
  if (!tenant) throw new Error("Tenant not found");

  const recentAudit = await prisma.platformAuditEvent.findMany({
    where: { tenantId },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return {
    ...tenant,
    recentAudit: recentAudit.map((r) => ({
      id: r.id,
      action: r.action,
      entityType: r.entityType,
      entityId: r.entityId,
      createdAt: r.createdAt.toISOString(),
      after: r.after,
    })),
  };
}

export type TenantUpdateInput = {
  legalName?: string;
  billingContact?: string;
  region?: string;
  notes?: string;
  accountOwner?: string;
  jnpAllowed?: boolean;
  outlookAllowed?: boolean;
  viotalkAllowed?: boolean;
  maintenanceMode?: boolean;
  maintenanceMessage?: string;
  enabled?: boolean;
};

export async function updateTenant(tenantId: string, patch: TenantUpdateInput, actorId: string) {
  const existingRaw = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!existingRaw) throw new Error("Tenant not found");
  const existing = asTenantRecord(existingRaw);

  const data: Record<string, string | boolean> = {};
  if (patch.legalName !== undefined) data.legalName = String(patch.legalName || "").trim();
  if (patch.billingContact !== undefined) data.billingContact = String(patch.billingContact || "").trim();
  if (patch.region !== undefined) data.region = String(patch.region || "").trim();
  if (patch.notes !== undefined) data.notes = String(patch.notes || "").trim();
  if (patch.accountOwner !== undefined) data.accountOwner = String(patch.accountOwner || "").trim();
  if (typeof patch.jnpAllowed === "boolean") data.jnpAllowed = patch.jnpAllowed;
  if (typeof patch.outlookAllowed === "boolean") data.outlookAllowed = patch.outlookAllowed;
  if (typeof patch.viotalkAllowed === "boolean") data.viotalkAllowed = patch.viotalkAllowed;
  if (typeof patch.maintenanceMode === "boolean") data.maintenanceMode = patch.maintenanceMode;
  if (patch.maintenanceMessage !== undefined) {
    data.maintenanceMessage = String(patch.maintenanceMessage || "").trim();
  }
  if (typeof patch.enabled === "boolean") data.enabled = patch.enabled;

  if (!Object.keys(data).length) throw new Error("No changes provided");

  const tenant = asTenantRecord(
    await prisma.tenant.update({
      where: { id: tenantId },
      data: data as never,
    }),
  );

  if (existing.enabled && tenant.enabled === false) {
    await notifyTenantDisabled(tenant.id, tenant.name).catch(() => null);
  } else if (!existing.enabled && tenant.enabled) {
    await notifyTenantEnabled(tenant.id, tenant.name).catch(() => null);
  }

  await platformAudit({
    actorId,
    action: "update_tenant",
    entityType: "tenant",
    entityId: tenant.id,
    tenantId: tenant.id,
    before: mapTenantBase(existing),
    after: mapTenantBase(tenant),
  });

  return mapTenantBase(tenant);
}

export async function createTenant(
  name: string,
  actorId: string,
  jnpAllowed = false,
  firstAdmin: { name: string; email: string; actorName: string },
  meta?: Partial<
    Pick<
      TenantUpdateInput,
      "legalName" | "billingContact" | "region" | "notes" | "accountOwner" | "outlookAllowed" | "viotalkAllowed"
    >
  >,
) {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Tenant name is required");
  if (!firstAdmin?.name?.trim() || !firstAdmin?.email?.trim()) {
    throw new Error(
      "First Administrator name and email are required. They must activate from the email invitation.",
    );
  }

  const tenant = asTenantRecord(
    await prisma.tenant.create({
      data: {
        name: trimmed,
        enabled: true,
        jnpAllowed: Boolean(jnpAllowed),
        outlookAllowed: meta?.outlookAllowed !== false,
        viotalkAllowed: meta?.viotalkAllowed !== false,
        legalName: String(meta?.legalName || "").trim(),
        billingContact: String(meta?.billingContact || "").trim(),
        region: String(meta?.region || "").trim(),
        notes: String(meta?.notes || "").trim(),
        accountOwner: String(meta?.accountOwner || "").trim(),
        settings: { create: {} },
      } as never,
    }),
  );

  await platformAudit({
    actorId,
    action: "create_tenant",
    entityType: "tenant",
    entityId: tenant.id,
    tenantId: tenant.id,
    after: mapTenantBase(tenant),
  });

  const adminInvite = await createFirstTenantAdmin({
    tenantId: tenant.id,
    email: firstAdmin.email,
    name: firstAdmin.name,
    actorId,
    actorName: firstAdmin.actorName,
  });

  return {
    ...mapTenantBase(tenant),
    adminInvite,
  };
}

export async function setTenantEnabled(tenantId: string, enabled: boolean, actorId: string) {
  return updateTenant(tenantId, { enabled }, actorId);
}

export async function setTenantJnpAllowed(tenantId: string, jnpAllowed: boolean, actorId: string) {
  return updateTenant(tenantId, { jnpAllowed }, actorId);
}

export async function createFirstTenantAdmin(input: {
  tenantId: string;
  email: string;
  name: string;
  actorId: string;
  actorName: string;
}) {
  const email = input.email.trim().toLowerCase();
  const name = input.name.trim();
  if (!email || !name) throw new Error("Name and email are required");

  const tenant = await prisma.tenant.findUnique({ where: { id: input.tenantId } });
  if (!tenant) throw new Error("Tenant not found");

  const existing = await prisma.user.findFirst({
    where: { tenantId: tenant.id, email },
  });
  if (existing) throw new Error("A user with that email already exists in this tenant");

  const existingAdmin = await prisma.user.findFirst({
    where: { tenantId: tenant.id, memberships: { some: { role: TbRole.admin } } },
  });
  if (existingAdmin) {
    throw new Error("This tenant already has an Administrator. Use Resend invite on that user.");
  }

  const user = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      email,
      name,
      title: "Administrator",
      memberships: { create: { tenantId: tenant.id, role: TbRole.admin } },
    },
  });

  const invite = await issueTenantAdminInvite({
    userId: user.id,
    tenantId: tenant.id,
    actorId: input.actorId,
    actorName: input.actorName,
    tenantName: tenant.name,
  });

  await platformAudit({
    actorId: input.actorId,
    action: "invite_tenant_admin",
    entityType: "user",
    entityId: user.id,
    tenantId: tenant.id,
    after: {
      userId: user.id,
      name: user.name,
      email: user.email,
      tenantId: tenant.id,
      tenantName: tenant.name,
      inviteSent: invite.sent,
      inviteStubbed: invite.stub,
    },
  });

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    invite,
  };
}

export async function resendFirstAdminInvite(input: {
  tenantId: string;
  userId: string;
  actorId: string;
  actorName: string;
}) {
  const tenant = await prisma.tenant.findUnique({ where: { id: input.tenantId } });
  if (!tenant) throw new Error("Tenant not found");

  const user = await prisma.user.findFirst({
    where: {
      id: input.userId,
      tenantId: tenant.id,
      memberships: { some: { role: TbRole.admin } },
    },
  });
  if (!user) throw new Error("Tenant Administrator not found");

  const invite = await issueTenantAdminInvite({
    userId: user.id,
    tenantId: tenant.id,
    actorId: input.actorId,
    actorName: input.actorName,
    tenantName: tenant.name,
  });

  await platformAudit({
    actorId: input.actorId,
    action: "resend_tenant_admin_invite",
    entityType: "user",
    entityId: user.id,
    tenantId: tenant.id,
    after: {
      userId: user.id,
      email: user.email,
      tenantId: tenant.id,
      tenantName: tenant.name,
      inviteSent: invite.sent,
      inviteStubbed: invite.stub,
    },
  });

  return { id: user.id, email: user.email, invite };
}
