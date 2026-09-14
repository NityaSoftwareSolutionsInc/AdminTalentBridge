import { prisma } from "./db";
import { platformAudit } from "./audit";
import { sendTransactionalEmail, sendgridConfigured } from "@/integrations/sendgrid";
import { logPlatformEmail } from "./email-log";
import type { PlatformSession } from "./auth";
import { canMutateTickets } from "./platform-rbac";
import { listOwnedTenantIds } from "./tenants";
import { buildTransactionalEmail } from "./email-template";
import { talentBridgeBaseUrl } from "./invite";

type PlatformTicketAuthorKind = "tenant_user" | "platform_staff";
type PlatformTicketCategory = "access" | "integrations" | "billing" | "bug" | "how_to" | "other";
type PlatformTicketPriority = "normal" | "high";
type PlatformTicketStatus = "open" | "in_progress" | "waiting_on_customer" | "resolved" | "closed";

const tickets = prisma as typeof prisma & {
  platformSupportTicket: {
    count: (args: unknown) => Promise<number>;
    findMany: (args: unknown) => Promise<any[]>;
    findFirst: (args: unknown) => Promise<any | null>;
    findUnique: (args: unknown) => Promise<any | null>;
    update: (args: unknown) => Promise<any>;
  };
  platformSupportTicketMessage: {
    create: (args: unknown) => Promise<any>;
  };
};

const OPEN_STATUSES: PlatformTicketStatus[] = ["open", "in_progress", "waiting_on_customer"];

function parseCategory(value: unknown): PlatformTicketCategory | null {
  if (
    value === "access" ||
    value === "integrations" ||
    value === "billing" ||
    value === "bug" ||
    value === "how_to" ||
    value === "other"
  ) {
    return value;
  }
  return null;
}

function parseStatus(value: unknown): PlatformTicketStatus | null {
  if (
    value === "open" ||
    value === "in_progress" ||
    value === "waiting_on_customer" ||
    value === "resolved" ||
    value === "closed"
  ) {
    return value;
  }
  return null;
}

function parsePriority(value: unknown): PlatformTicketPriority | null {
  if (value === "normal" || value === "high") return value;
  return null;
}

export const TICKET_CATEGORY_LABEL: Record<PlatformTicketCategory, string> = {
  access: "Access",
  integrations: "Integrations",
  billing: "Billing",
  bug: "Bug",
  how_to: "How to",
  other: "Other",
};

export const TICKET_STATUS_LABEL: Record<PlatformTicketStatus, string> = {
  open: "Open",
  in_progress: "In progress",
  waiting_on_customer: "Waiting on customer",
  resolved: "Resolved",
  closed: "Closed",
};

async function ticketScopeWhere(session: PlatformSession) {
  if (session.role === "manager") {
    const ids = await listOwnedTenantIds(session.platformAdminId);
    return { tenantId: { in: ids.length ? ids : ["__none__"] } };
  }
  return {};
}

function mapTicket(row: {
  id: string;
  tenantId: string;
  createdByUserId: string;
  assignedToId: string | null;
  category: PlatformTicketCategory;
  priority: PlatformTicketPriority;
  subject: string;
  status: PlatformTicketStatus;
  createdAt: Date;
  updatedAt: Date;
  resolvedAt: Date | null;
  closedAt: Date | null;
  tenant?: { id: string; name: string } | null;
  createdByUser?: { id: string; name: string; email: string } | null;
  assignedTo?: { id: string; name: string; email: string } | null;
  messages?: Array<{
    id: string;
    authorKind: PlatformTicketAuthorKind;
    body: string;
    createdAt: Date;
    authorUser?: { id: string; name: string; email: string } | null;
    authorPlatformAdmin?: { id: string; name: string; email: string } | null;
  }>;
}) {
  return {
    id: row.id,
    tenantId: row.tenantId,
    tenantName: row.tenant?.name || "",
    createdByUserId: row.createdByUserId,
    requester: row.createdByUser
      ? { id: row.createdByUser.id, name: row.createdByUser.name, email: row.createdByUser.email }
      : null,
    assignedTo: row.assignedTo
      ? { id: row.assignedTo.id, name: row.assignedTo.name, email: row.assignedTo.email }
      : null,
    category: row.category,
    categoryLabel: TICKET_CATEGORY_LABEL[row.category],
    priority: row.priority,
    subject: row.subject,
    status: row.status,
    statusLabel: TICKET_STATUS_LABEL[row.status],
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    resolvedAt: row.resolvedAt?.toISOString() ?? null,
    closedAt: row.closedAt?.toISOString() ?? null,
    messages: (row.messages || []).map((m) => ({
      id: m.id,
      authorKind: m.authorKind,
      body: m.body,
      createdAt: m.createdAt.toISOString(),
      author:
        m.authorKind === "platform_staff"
          ? m.authorPlatformAdmin
            ? { name: m.authorPlatformAdmin.name, email: m.authorPlatformAdmin.email }
            : { name: "Platform staff", email: "" }
          : m.authorUser
            ? { name: m.authorUser.name, email: m.authorUser.email }
            : { name: "Tenant user", email: "" },
    })),
  };
}

const staffInclude = {
  tenant: { select: { id: true, name: true } },
  createdByUser: { select: { id: true, name: true, email: true } },
  assignedTo: { select: { id: true, name: true, email: true } },
} as const;

const detailInclude = {
  ...staffInclude,
  messages: {
    orderBy: { createdAt: "asc" as const },
    include: {
      authorUser: { select: { id: true, name: true, email: true } },
      authorPlatformAdmin: { select: { id: true, name: true, email: true } },
    },
  },
};

export async function countOpenTickets(session: PlatformSession) {
  const scope = await ticketScopeWhere(session);
  return tickets.platformSupportTicket.count({
    where: { ...scope, status: { in: OPEN_STATUSES } },
  });
}

export async function listPlatformTickets(
  session: PlatformSession,
  filter?: { status?: string; q?: string },
) {
  const scope = await ticketScopeWhere(session);
  const status = parseStatus(filter?.status);
  const q = filter?.q?.trim();
  const rows = await tickets.platformSupportTicket.findMany({
    where: {
      ...scope,
      ...(status ? { status } : {}),
      ...(q
        ? {
            OR: [
              { subject: { contains: q, mode: "insensitive" } },
              { tenant: { name: { contains: q, mode: "insensitive" } } },
              { createdByUser: { email: { contains: q, mode: "insensitive" } } },
            ],
          }
        : {}),
    },
    orderBy: [{ priority: "desc" }, { updatedAt: "desc" }],
    include: staffInclude,
  });
  return rows.map((row) => mapTicket(row));
}

export async function getPlatformTicket(session: PlatformSession, ticketId: string) {
  const scope = await ticketScopeWhere(session);
  const row = await tickets.platformSupportTicket.findFirst({
    where: { id: ticketId, ...scope },
    include: detailInclude,
  });
  if (!row) throw new Error("Ticket not found");
  return mapTicket(row);
}

async function notifyRequester(input: {
  ticketId: string;
  tenantId: string;
  toEmail: string;
  toName: string;
  subject: string;
  intro: string;
  actorId: string;
}) {
  const talentBridgeUrl = talentBridgeBaseUrl();
  const { text, html } = buildTransactionalEmail({
    greetingName: input.toName,
    intro: input.intro,
    ctaLabel: "Open TalentBridge",
    ctaUrl: talentBridgeUrl,
    footer: "Sign in to TalentBridge and open Help & Support to view the full thread and reply.",
    assetBaseUrl: talentBridgeUrl,
  });
  let status: "sent" | "stubbed" | "failed" = "stubbed";
  let providerId = "";
  let error = "";
  try {
    const delivery = await sendTransactionalEmail({
      to: input.toEmail,
      subject: input.subject,
      text,
      html,
    });
    status = delivery.stub ? "stubbed" : "sent";
    providerId = delivery.messageId || "";
    if (delivery.stub) {
      console.info("[sendgrid-stub] support ticket reply", { to: input.toEmail, ticketId: input.ticketId });
    }
  } catch (e) {
    status = "failed";
    error = e instanceof Error ? e.message : "send failed";
  }
  await logPlatformEmail({
    kind: "support_ticket_reply",
    toEmail: input.toEmail,
    subject: input.subject,
    status,
    providerId,
    error,
    tenantId: input.tenantId,
    actorId: input.actorId,
    relatedUserId: input.ticketId,
  });
  return { sent: status === "sent", stub: status === "stubbed", configured: sendgridConfigured() };
}

export async function replyToPlatformTicket(
  session: PlatformSession,
  ticketId: string,
  input: { body?: string; status?: string; assignedToId?: string | null; priority?: string },
) {
  if (!canMutateTickets(session)) throw new Error("You cannot update tickets");
  const ticket = await tickets.platformSupportTicket.findUnique({
    where: { id: ticketId },
    include: { createdByUser: true, tenant: true },
  });
  if (!ticket) throw new Error("Ticket not found");

  const body = String(input.body || "").trim();
  const nextStatus = parseStatus(input.status);
  const nextPriority = parsePriority(input.priority);
  const data: {
    status?: PlatformTicketStatus;
    priority?: PlatformTicketPriority;
    assignedToId?: string | null;
    resolvedAt?: Date | null;
    closedAt?: Date | null;
  } = {};

  if (nextStatus && nextStatus !== ticket.status) {
    data.status = nextStatus;
    data.resolvedAt = nextStatus === "resolved" ? new Date() : nextStatus === "open" ? null : ticket.resolvedAt;
    data.closedAt = nextStatus === "closed" ? new Date() : nextStatus === "open" ? null : ticket.closedAt;
  }
  if (nextPriority) data.priority = nextPriority;
  if (input.assignedToId !== undefined) {
    data.assignedToId = input.assignedToId || null;
  }

  if (!body && !Object.keys(data).length) throw new Error("No changes provided");

  if (body) {
    await tickets.platformSupportTicketMessage.create({
      data: {
        ticketId: ticket.id,
        authorKind: "platform_staff",
        authorPlatformAdminId: session.platformAdminId,
        body,
      },
    });
    if (!data.status && (ticket.status === "open" || ticket.status === "waiting_on_customer")) {
      data.status = "in_progress";
    }
  }

  if (Object.keys(data).length) {
    await tickets.platformSupportTicket.update({
      where: { id: ticket.id },
      data,
    });
  }

  await platformAudit({
    actorId: session.platformAdminId,
    action: body ? "support_ticket_reply" : "support_ticket_update",
    entityType: "support_ticket",
    entityId: ticket.id,
    tenantId: ticket.tenantId,
    after: { status: data.status || ticket.status, assignedToId: data.assignedToId, hasReply: Boolean(body) },
  });

  let mail: { sent: boolean; stub: boolean; configured: boolean } | null = null;
  if (body || data.status === "resolved" || data.status === "closed" || data.status === "waiting_on_customer") {
    const intro = body
      ? `Support replied on “${ticket.subject}”: ${body.slice(0, 400)}`
      : `Your TalentBridge support ticket “${ticket.subject}” is now ${TICKET_STATUS_LABEL[data.status || ticket.status]}.`;
    mail = await notifyRequester({
      ticketId: ticket.id,
      tenantId: ticket.tenantId,
      toEmail: ticket.createdByUser.email,
      toName: ticket.createdByUser.name,
      subject: `TalentBridge support: ${ticket.subject}`,
      intro,
      actorId: session.platformAdminId,
    });
  }

  const updated = await getPlatformTicket(session, ticket.id);
  return { ticket: updated, mail };
}

export { parseCategory, parseStatus, parsePriority, OPEN_STATUSES };
