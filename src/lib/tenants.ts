import { TbRole } from "@prisma/client";
import { prisma } from "./db";
import { platformAudit } from "./audit";
import { issueTenantAdminInvite } from "./invite";

export async function listTenants() {
  const rows = await prisma.tenant.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { users: true } },
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
        },
      },
    },
  });

  return rows.map((t) => ({
    id: t.id,
    name: t.name,
    enabled: t.enabled,
    createdAt: t.createdAt.toISOString(),
    userCount: t._count.users,
    admins: t.users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      inviteSentAt: u.inviteSentAt?.toISOString() ?? null,
      passwordSet: Boolean(u.passwordHash),
    })),
  }));
}

export async function createTenant(name: string, actorId: string) {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Tenant name is required");

  const tenant = await prisma.tenant.create({
    data: {
      name: trimmed,
      enabled: true,
      settings: { create: {} },
    },
  });

  await platformAudit({
    actorId,
    action: "create_tenant",
    entityType: "tenant",
    entityId: tenant.id,
    tenantId: tenant.id,
    after: { name: tenant.name, enabled: tenant.enabled },
  });

  return { id: tenant.id, name: tenant.name, enabled: tenant.enabled };
}

export async function setTenantEnabled(tenantId: string, enabled: boolean, actorId: string) {
  const existing = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!existing) throw new Error("Tenant not found");

  const tenant = await prisma.tenant.update({
    where: { id: tenantId },
    data: { enabled },
  });

  await platformAudit({
    actorId,
    action: enabled ? "enable_tenant" : "disable_tenant",
    entityType: "tenant",
    entityId: tenant.id,
    tenantId: tenant.id,
    before: { name: existing.name, enabled: existing.enabled },
    after: { name: tenant.name, enabled: tenant.enabled },
  });

  return { id: tenant.id, name: tenant.name, enabled: tenant.enabled };
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
