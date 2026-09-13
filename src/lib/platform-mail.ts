import { TbRole } from "@prisma/client";
import { prisma } from "./db";
import { sendTransactionalEmail, sendgridConfigured } from "@/integrations/sendgrid";
import { assertPassword, hashPassword, hashToken, newSecretToken } from "./password";
import { talentBridgeBaseUrl } from "./invite";

const RESET_EXPIRY_HOURS = 24;

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (ch) => {
    const map: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
    return map[ch] || ch;
  });
}

function adminBaseUrl(originHeader?: string | null) {
  const configured = (process.env.APP_BASE_URL || "").trim().replace(/\/$/, "");
  if (configured) return configured;
  if (originHeader) return originHeader.replace(/\/$/, "");
  return "http://localhost:3002";
}

async function deliver(input: {
  to: string;
  name: string;
  subject: string;
  intro: string;
  ctaLabel?: string;
  ctaUrl?: string;
  footer?: string;
  stubLabel: string;
}) {
  const lines = [`Hi ${input.name},`, "", input.intro, ""];
  if (input.ctaUrl) lines.push(`${input.ctaLabel || "Open link"}: ${input.ctaUrl}`, "");
  if (input.footer) lines.push(input.footer, "");
  lines.push("If you did not expect this email, ignore it.");

  const htmlParts = [
    `<p>Hi ${escapeHtml(input.name)},</p>`,
    `<p>${escapeHtml(input.intro)}</p>`,
  ];
  if (input.ctaUrl) {
    htmlParts.push(
      `<p><a href="${escapeHtml(input.ctaUrl)}">${escapeHtml(input.ctaLabel || "Open link")}</a></p>`,
    );
  }
  if (input.footer) htmlParts.push(`<p>${escapeHtml(input.footer)}</p>`);
  htmlParts.push("<p>If you did not expect this email, ignore it.</p>");

  const delivery = await sendTransactionalEmail({
    to: input.to,
    subject: input.subject,
    text: lines.join("\n"),
    html: htmlParts.join("\n"),
  });
  if (delivery.stub) {
    console.info(`[sendgrid-stub] ${input.stubLabel}`, {
      to: input.to,
      subject: input.subject,
      url: input.ctaUrl,
    });
  }
  return delivery;
}

/** Always returns the same shape — does not reveal whether the email exists. */
export async function requestPlatformAdminForgotPassword(emailRaw: string, origin?: string | null) {
  const email = String(emailRaw || "").trim().toLowerCase();
  const generic = {
    ok: true as const,
    message: "If that email is a Global Admin account, a reset link has been sent.",
  };
  if (!email || !email.includes("@")) return generic;

  const admin = await prisma.platformAdmin.findFirst({
    where: { email, enabled: true },
  });
  if (!admin) return generic;

  const token = newSecretToken();
  const expires = new Date(Date.now() + RESET_EXPIRY_HOURS * 60 * 60 * 1000);
  const url = `${adminBaseUrl(origin)}/set-password?token=${encodeURIComponent(token)}`;

  await prisma.platformAdmin.update({
    where: { id: admin.id },
    data: {
      passwordResetTokenHash: hashToken(token),
      passwordResetExpiresAt: expires,
    },
  });

  try {
    await deliver({
      to: admin.email,
      name: admin.name,
      subject: "Reset your TalentBridge Global Admin password",
      intro: "A password reset was requested for your TalentBridge Global Admin account.",
      ctaLabel: "Set your password",
      ctaUrl: url,
      footer: `This link expires in ${RESET_EXPIRY_HOURS} hours.`,
      stubLabel: "platform-admin-reset",
    });
  } catch {
    /* keep generic response */
  }
  return generic;
}

export async function completePlatformAdminPasswordSetup(token: string, password: string) {
  const raw = String(token || "").trim();
  if (!raw) throw new Error("Reset link is missing");
  assertPassword(password);

  const admin = await prisma.platformAdmin.findFirst({
    where: {
      passwordResetTokenHash: hashToken(raw),
      passwordResetExpiresAt: { gt: new Date() },
      enabled: true,
    },
  });
  if (!admin) throw new Error("This link is invalid or has expired. Request a new reset email.");

  const passwordHash = await hashPassword(password);
  await prisma.platformAdmin.update({
    where: { id: admin.id },
    data: {
      passwordHash,
      passwordResetTokenHash: null,
      passwordResetExpiresAt: null,
      mustChangePassword: false,
      passwordChangedAt: new Date(),
    },
  });

  try {
    await deliver({
      to: admin.email,
      name: admin.name,
      subject: "Your TalentBridge Global Admin password was changed",
      intro: "Your Global Admin password was set or changed successfully. If you did not do this, secure the account and rotate SendGrid/platform secrets.",
      stubLabel: "platform-admin-password-changed",
    });
  } catch (error) {
    console.error("[sendgrid] platform password-changed notice failed", error);
  }

  return { email: admin.email };
}

export async function notifyTenantDisabled(tenantId: string, tenantName: string) {
  const users = await prisma.user.findMany({
    where: {
      tenantId,
      enabled: true,
      memberships: { some: { role: TbRole.admin } },
    },
    select: { email: true, name: true },
  });

  const loginUrl = `${talentBridgeBaseUrl()}/login`;
  await Promise.all(
    users.map((user) =>
      deliver({
        to: user.email,
        name: user.name,
        subject: `TalentBridge organization disabled (${tenantName})`,
        intro: `The TalentBridge organization “${tenantName}” has been disabled by a platform administrator. Users from this organization cannot sign in until it is re-enabled.`,
        ctaLabel: "TalentBridge sign-in",
        ctaUrl: loginUrl,
        stubLabel: "tenant-disabled",
      }).catch((error) => {
        console.error("[sendgrid] tenant-disabled notice failed", error);
      }),
    ),
  );
}

export async function notifyTenantEnabled(tenantId: string, tenantName: string) {
  const users = await prisma.user.findMany({
    where: {
      tenantId,
      enabled: true,
      memberships: { some: { role: TbRole.admin } },
    },
    select: { email: true, name: true },
  });

  const loginUrl = `${talentBridgeBaseUrl()}/login`;
  await Promise.all(
    users.map((user) =>
      deliver({
        to: user.email,
        name: user.name,
        subject: `TalentBridge organization re-enabled (${tenantName})`,
        intro: `The TalentBridge organization “${tenantName}” has been re-enabled. Administrators and users can sign in again.`,
        ctaLabel: "Sign in to TalentBridge",
        ctaUrl: loginUrl,
        stubLabel: "tenant-enabled",
      }).catch((error) => {
        console.error("[sendgrid] tenant-enabled notice failed", error);
      }),
    ),
  );
}

export { sendgridConfigured };
