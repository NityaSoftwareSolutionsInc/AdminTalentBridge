import { prisma } from "./db";
import { sendTransactionalEmail, sendgridConfigured } from "@/integrations/sendgrid";
import { hashToken, newSecretToken } from "./password";
import { logPlatformEmail } from "./email-log";
import { buildTransactionalEmail } from "./email-template";

const INVITE_EXPIRY_HOURS = 48;

export function talentBridgeBaseUrl() {
  return (process.env.TALENTBRIDGE_APP_BASE_URL || "http://localhost:3011").trim().replace(/\/$/, "");
}

export async function issueTenantAdminInvite(input: {
  userId: string;
  tenantId: string;
  actorId?: string;
  actorName: string;
  tenantName: string;
}) {
  const user = await prisma.user.findFirst({
    where: { id: input.userId, tenantId: input.tenantId },
  });
  if (!user) throw new Error("User not found in this tenant");
  if (!user.enabled) throw new Error("Cannot email a disabled user");

  const token = newSecretToken();
  const expires = new Date(Date.now() + INVITE_EXPIRY_HOURS * 60 * 60 * 1000);
  const url = `${talentBridgeBaseUrl()}/set-password?token=${encodeURIComponent(token)}`;

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordResetTokenHash: hashToken(token),
      passwordResetExpiresAt: expires,
      passwordResetKind: "invite",
      inviteSentAt: new Date(),
    },
  });

  const subject = `Activate your TalentBridge Administrator account (${input.tenantName})`;
  const intro = `${input.actorName} created ${input.tenantName} on TalentBridge and named you as the first Administrator. Open the link in this email to activate your account and set your password. You cannot sign in until you activate.`;
  const { text, html } = buildTransactionalEmail({
    greetingName: user.name,
    intro,
    ctaLabel: "Activate your account",
    ctaUrl: url,
    footer: `This activation link expires in ${INVITE_EXPIRY_HOURS} hours and can be used once.`,
    assetBaseUrl: talentBridgeBaseUrl(),
  });

  let status: "sent" | "stubbed" | "failed" = "stubbed";
  let providerId = "";
  let error = "";
  try {
    const delivery = await sendTransactionalEmail({
      to: user.email,
      subject,
      text,
      html,
    });
    status = delivery.stub ? "stubbed" : "sent";
    providerId = delivery.messageId || "";
    if (delivery.stub) {
      console.info("[sendgrid-stub] tenant admin invite", { to: user.email, url });
    }
  } catch (e) {
    status = "failed";
    error = e instanceof Error ? e.message : "send failed";
  }

  await logPlatformEmail({
    kind: "tenant_admin_invite",
    toEmail: user.email,
    subject,
    status,
    providerId,
    error,
    tenantId: input.tenantId,
    actorId: input.actorId || null,
    relatedUserId: user.id,
    previewUrl: status === "stubbed" ? url : "",
  });

  if (status === "failed") {
    throw new Error(error || "Invitation email could not be sent");
  }

  return {
    userId: user.id,
    email: user.email,
    sent: status === "sent",
    stub: status === "stubbed",
    configured: sendgridConfigured(),
    previewUrl: status === "stubbed" ? url : undefined,
  };
}
