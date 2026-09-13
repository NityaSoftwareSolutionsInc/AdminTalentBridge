import { prisma } from "./db";
import { platformAudit } from "./audit";
import { assertPassword, hashPassword, hashToken, newSecretToken } from "./password";
import { sendTransactionalEmail, sendgridConfigured } from "@/integrations/sendgrid";
import { logPlatformEmail } from "./email-log";

const INVITE_EXPIRY_HOURS = 48;
const LOCK_AFTER_FAILURES = 5;
const LOCK_MINUTES = 15;

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (ch) => {
    const map: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
    return map[ch] || ch;
  });
}

function adminBaseUrl() {
  return (process.env.APP_BASE_URL || "http://localhost:3002").trim().replace(/\/$/, "");
}

export async function listPlatformAdmins() {
  const rows = await prisma.platformAdmin.findMany({ orderBy: { createdAt: "asc" } });
  return rows.map((a) => ({
    id: a.id,
    name: a.name,
    email: a.email,
    enabled: a.enabled,
    mustChangePassword: a.mustChangePassword,
    passwordChangedAt: a.passwordChangedAt?.toISOString() ?? null,
    lastLoginAt: a.lastLoginAt?.toISOString() ?? null,
    failedLoginCount: a.failedLoginCount,
    lockedUntil: a.lockedUntil?.toISOString() ?? null,
    inviteSentAt: a.inviteSentAt?.toISOString() ?? null,
    createdAt: a.createdAt.toISOString(),
  }));
}

export async function invitePlatformAdmin(input: {
  name: string;
  email: string;
  actorId: string;
  actorName: string;
}) {
  const email = input.email.trim().toLowerCase();
  const name = input.name.trim();
  if (!email || !name) throw new Error("Name and email are required");

  const existing = await prisma.platformAdmin.findUnique({ where: { email } });
  if (existing) throw new Error("A Global Admin with that email already exists");

  const tempHash = await hashPassword(newSecretToken().slice(0, 24) + "Aa1!");
  const admin = await prisma.platformAdmin.create({
    data: {
      email,
      name,
      passwordHash: tempHash,
      enabled: true,
      mustChangePassword: true,
    },
  });

  const invite = await issuePlatformAdminInvite({
    adminId: admin.id,
    actorId: input.actorId,
    actorName: input.actorName,
  });

  await platformAudit({
    actorId: input.actorId,
    action: "invite_platform_admin",
    entityType: "platform_admin",
    entityId: admin.id,
    after: { email, name, inviteSent: invite.sent, inviteStubbed: invite.stub },
  });

  return { id: admin.id, name: admin.name, email: admin.email, invite };
}

export async function issuePlatformAdminInvite(input: {
  adminId: string;
  actorId: string;
  actorName: string;
}) {
  const admin = await prisma.platformAdmin.findUnique({ where: { id: input.adminId } });
  if (!admin) throw new Error("Platform admin not found");
  if (!admin.enabled) throw new Error("Cannot invite a disabled admin");

  const token = newSecretToken();
  const expires = new Date(Date.now() + INVITE_EXPIRY_HOURS * 60 * 60 * 1000);
  const url = `${adminBaseUrl()}/set-password?token=${encodeURIComponent(token)}`;

  await prisma.platformAdmin.update({
    where: { id: admin.id },
    data: {
      passwordResetTokenHash: hashToken(token),
      passwordResetExpiresAt: expires,
      inviteSentAt: new Date(),
      mustChangePassword: true,
    },
  });

  const subject = "Activate your TalentBridge Global Admin account";
  const intro = `${input.actorName} invited you as a Global Admin on TalentBridge Platform Admin. Activate from this email to set your password.`;
  let status: "sent" | "stubbed" | "failed" = "stubbed";
  let providerId = "";
  let error = "";
  try {
    const delivery = await sendTransactionalEmail({
      to: admin.email,
      subject,
      text: [`Hi ${admin.name},`, "", intro, "", `Activate: ${url}`, `Expires in ${INVITE_EXPIRY_HOURS} hours.`].join("\n"),
      html: `<p>Hi ${escapeHtml(admin.name)},</p><p>${escapeHtml(intro)}</p><p><a href="${escapeHtml(url)}">Activate your account</a></p>`,
    });
    status = delivery.stub ? "stubbed" : "sent";
    providerId = delivery.messageId || "";
    if (delivery.stub) console.info("[sendgrid-stub] platform admin invite", { to: admin.email, url });
  } catch (e) {
    status = "failed";
    error = e instanceof Error ? e.message : "send failed";
  }

  await logPlatformEmail({
    kind: "platform_admin_invite",
    toEmail: admin.email,
    subject,
    status,
    providerId,
    error,
    actorId: input.actorId,
    relatedUserId: admin.id,
    previewUrl: status === "stubbed" ? url : "",
  });

  if (status === "failed") throw new Error(error || "Invitation email could not be sent");

  return {
    sent: status === "sent",
    stub: status === "stubbed",
    configured: sendgridConfigured(),
    previewUrl: status === "stubbed" ? url : undefined,
    email: admin.email,
  };
}

export async function setPlatformAdminEnabled(adminId: string, enabled: boolean, actorId: string) {
  if (adminId === actorId && !enabled) throw new Error("You cannot disable your own account");
  const existing = await prisma.platformAdmin.findUnique({ where: { id: adminId } });
  if (!existing) throw new Error("Platform admin not found");

  const admin = await prisma.platformAdmin.update({
    where: { id: adminId },
    data: { enabled },
  });

  await platformAudit({
    actorId,
    action: enabled ? "enable_platform_admin" : "disable_platform_admin",
    entityType: "platform_admin",
    entityId: admin.id,
    before: { enabled: existing.enabled, email: existing.email },
    after: { enabled: admin.enabled, email: admin.email },
  });

  return { id: admin.id, email: admin.email, enabled: admin.enabled };
}

export async function recordPlatformLoginAttempt(input: {
  email: string;
  success: boolean;
  platformAdminId?: string | null;
  reason?: string;
  ip?: string;
}) {
  await prisma.platformLoginEvent.create({
    data: {
      email: input.email,
      success: input.success,
      platformAdminId: input.platformAdminId || null,
      reason: input.reason || "",
      ip: input.ip || "",
    },
  });
}

export async function listPlatformLoginEvents(limit = 50) {
  const rows = await prisma.platformLoginEvent.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  return rows.map((r) => ({
    id: r.id,
    email: r.email,
    success: r.success,
    reason: r.reason,
    ip: r.ip,
    platformAdminId: r.platformAdminId,
    createdAt: r.createdAt.toISOString(),
  }));
}

export async function applyFailedPlatformLogin(adminId: string | null, email: string) {
  if (!adminId) {
    await recordPlatformLoginAttempt({ email, success: false, reason: "invalid_credentials" });
    return;
  }
  const admin = await prisma.platformAdmin.findUnique({ where: { id: adminId } });
  if (!admin) return;
  const failedLoginCount = admin.failedLoginCount + 1;
  const lockedUntil =
    failedLoginCount >= LOCK_AFTER_FAILURES
      ? new Date(Date.now() + LOCK_MINUTES * 60 * 1000)
      : admin.lockedUntil;
  await prisma.platformAdmin.update({
    where: { id: adminId },
    data: { failedLoginCount, lockedUntil },
  });
  await recordPlatformLoginAttempt({
    email,
    success: false,
    platformAdminId: adminId,
    reason: lockedUntil && lockedUntil > new Date() ? "locked" : "invalid_credentials",
  });
}

export async function applySuccessfulPlatformLogin(adminId: string, email: string, ip?: string) {
  await prisma.platformAdmin.update({
    where: { id: adminId },
    data: {
      lastLoginAt: new Date(),
      failedLoginCount: 0,
      lockedUntil: null,
    },
  });
  await recordPlatformLoginAttempt({ email, success: true, platformAdminId: adminId, ip });
}

export async function changeOwnPlatformPassword(adminId: string, currentPassword: string, nextPassword: string) {
  const admin = await prisma.platformAdmin.findUnique({ where: { id: adminId } });
  if (!admin) throw new Error("Not found");
  const { verifyPassword } = await import("./password");
  const ok = await verifyPassword(currentPassword, admin.passwordHash);
  if (!ok) throw new Error("Current password is incorrect");
  assertPassword(nextPassword);
  const passwordHash = await hashPassword(nextPassword);
  await prisma.platformAdmin.update({
    where: { id: adminId },
    data: {
      passwordHash,
      mustChangePassword: false,
      passwordChangedAt: new Date(),
      passwordResetTokenHash: null,
      passwordResetExpiresAt: null,
    },
  });
}

export { LOCK_AFTER_FAILURES, LOCK_MINUTES };
