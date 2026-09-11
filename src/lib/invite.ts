import { prisma } from "./db";
import { sendTransactionalEmail, sendgridConfigured } from "@/integrations/sendgrid";
import { hashToken, newSecretToken } from "./password";

const INVITE_EXPIRY_HOURS = 48;

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (ch) => {
    const map: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
    return map[ch] || ch;
  });
}

export function talentBridgeBaseUrl() {
  return (process.env.TALENTBRIDGE_APP_BASE_URL || "http://localhost:3001").trim().replace(/\/$/, "");
}

export async function issueTenantAdminInvite(input: {
  userId: string;
  tenantId: string;
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

  const subject = `You're invited to TalentBridge as Administrator (${input.tenantName})`;
  const intro = `${input.actorName} invited you as Administrator for ${input.tenantName} on TalentBridge. Set your password to sign in.`;
  const text = [
    `Hi ${user.name},`,
    "",
    intro,
    "",
    `Set your password: ${url}`,
    `This link expires in ${INVITE_EXPIRY_HOURS} hours.`,
    "",
    "If you did not expect this email, ignore it.",
  ].join("\n");
  const html = `<p>Hi ${escapeHtml(user.name)},</p>
<p>${escapeHtml(intro)}</p>
<p><a href="${escapeHtml(url)}">Set your password</a></p>
<p>This link expires in ${INVITE_EXPIRY_HOURS} hours.</p>
<p>If you did not expect this email, ignore it.</p>`;

  const delivery = await sendTransactionalEmail({
    to: user.email,
    subject,
    text,
    html,
  });

  if (delivery.stub) {
    console.info("[sendgrid-stub] tenant admin invite", { to: user.email, url });
  }

  return {
    userId: user.id,
    email: user.email,
    sent: delivery.sent,
    stub: delivery.stub,
    configured: sendgridConfigured(),
    previewUrl: delivery.stub ? url : undefined,
  };
}
