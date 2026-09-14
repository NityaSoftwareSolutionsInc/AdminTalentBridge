import { TbRole } from "@prisma/client";
import { prisma } from "./db";
import { sendTransactionalEmail, sendgridConfigured } from "@/integrations/sendgrid";
import { assertPassword, hashPassword, hashToken, newSecretToken } from "./password";
import { talentBridgeBaseUrl } from "./invite";
import { buildTransactionalEmail } from "./email-template";

const RESET_EXPIRY_HOURS = 24;

function adminBaseUrl(originHeader?: string | null) {
  const configured = (process.env.APP_BASE_URL || "").trim().replace(/\/$/, "");
  if (configured) return configured;
  if (originHeader) return originHeader.replace(/\/$/, "");
  return "http://localhost:3012";
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
  assetBaseUrl?: string;
}) {
  const { text, html } = buildTransactionalEmail({
    greetingName: input.name,
    intro: input.intro,
    ctaLabel: input.ctaLabel,
    ctaUrl: input.ctaUrl,
    footer: input.footer,
    assetBaseUrl: input.assetBaseUrl || talentBridgeBaseUrl(),
  });

  const delivery = await sendTransactionalEmail({
    to: input.to,
    subject: input.subject,
    text,
    html,
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
    message: "If that email is a platform account, a reset link has been sent.",
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
      subject: "Reset your TalentBridge platform password",
      intro: "A password reset was requested for your TalentBridge platform account.",
      ctaLabel: "Set your password",
      ctaUrl: url,
      footer: `This link expires in ${RESET_EXPIRY_HOURS} hours.`,
      stubLabel: "platform-admin-reset",
      assetBaseUrl: adminBaseUrl(origin),
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
      subject: "Your TalentBridge platform password was changed",
      intro:
        "Your platform password was set or changed successfully. If you did not do this, secure the account and rotate SendGrid/platform secrets.",
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
        assetBaseUrl: talentBridgeBaseUrl(),
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
        assetBaseUrl: talentBridgeBaseUrl(),
      }).catch((error) => {
        console.error("[sendgrid] tenant-enabled notice failed", error);
      }),
    ),
  );
}

export { sendgridConfigured };
