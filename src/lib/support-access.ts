import { SignJWT, jwtVerify } from "jose";
import { prisma } from "./db";
import { platformAudit } from "./audit";
import { talentBridgeBaseUrl } from "./invite";

const SUPPORT_TTL_SEC = 60 * 30;

function jwtSecret() {
  const raw = process.env.AUTH_JWT_SECRET || "";
  if (raw.length < 16) throw new Error("AUTH_JWT_SECRET must be at least 16 characters");
  return new TextEncoder().encode(raw);
}

export type SupportAccessClaims = {
  purpose: "support_access";
  platformAdminId: string;
  tenantId: string;
  userId: string;
  readOnly: true;
};

export async function createSupportAccessUrl(input: {
  platformAdminId: string;
  tenantId: string;
  userId?: string;
}) {
  const tenant = await prisma.tenant.findUnique({ where: { id: input.tenantId } });
  if (!tenant) throw new Error("Tenant not found");
  if (!tenant.enabled) throw new Error("Cannot open a disabled tenant");
  if (tenant.maintenanceMode) {
    throw new Error("Tenant is in maintenance mode. Clear maintenance before support access.");
  }

  let user =
    input.userId
      ? await prisma.user.findFirst({
          where: {
            id: input.userId,
            tenantId: tenant.id,
            enabled: true,
            memberships: { some: { role: "admin" } },
          },
        })
      : null;

  if (!user) {
    user = await prisma.user.findFirst({
      where: {
        tenantId: tenant.id,
        enabled: true,
        memberships: { some: { role: "admin" } },
        passwordHash: { not: null },
      },
      orderBy: { createdAt: "asc" },
    });
  }
  if (!user) {
    throw new Error("No activated Administrator found for support access");
  }

  const token = await new SignJWT({
    purpose: "support_access",
    platform_admin_id: input.platformAdminId,
    company_id: tenant.id,
    user_id: user.id,
    read_only: true,
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(`${SUPPORT_TTL_SEC}s`)
    .sign(jwtSecret());

  await platformAudit({
    actorId: input.platformAdminId,
    action: "support_access_issued",
    entityType: "tenant",
    entityId: tenant.id,
    tenantId: tenant.id,
    after: {
      userId: user.id,
      email: user.email,
      readOnly: true,
      expiresInSec: SUPPORT_TTL_SEC,
    },
  });

  const url = `${talentBridgeBaseUrl()}/api/support-session?token=${encodeURIComponent(token)}`;
  return {
    url,
    expiresInSec: SUPPORT_TTL_SEC,
    user: { id: user.id, name: user.name, email: user.email },
    tenant: { id: tenant.id, name: tenant.name },
  };
}

export async function verifySupportAccessToken(token: string): Promise<SupportAccessClaims | null> {
  try {
    const { payload } = await jwtVerify(token, jwtSecret(), { algorithms: ["HS256"] });
    if (String(payload.purpose || "") !== "support_access") return null;
    const platformAdminId = String(payload.platform_admin_id || "");
    const tenantId = String(payload.company_id || "");
    const userId = String(payload.sub || payload.user_id || "");
    if (!platformAdminId || !tenantId || !userId) return null;
    return { purpose: "support_access", platformAdminId, tenantId, userId, readOnly: true };
  } catch {
    return null;
  }
}
