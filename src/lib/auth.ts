import { cookies } from "next/headers";
import { prisma } from "./db";
import { SESSION_COOKIE, verifyPlatformToken } from "./jwt";
import type { PlatformRole } from "./platform-rbac";

export type PlatformSession = {
  platformAdminId: string;
  name: string;
  email: string;
  role: PlatformRole;
  mustChangePassword: boolean;
  lastLoginAt: string | null;
};

export async function getPlatformSession(): Promise<PlatformSession | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const claims = await verifyPlatformToken(token);
  if (!claims) return null;

  const admin = await prisma.platformAdmin.findFirst({
    where: { id: claims.platformAdminId, enabled: true },
  });
  if (!admin) return null;
  if (admin.lockedUntil && admin.lockedUntil > new Date()) return null;

  return {
    platformAdminId: admin.id,
    name: admin.name,
    email: admin.email,
    role: (admin as { role?: PlatformRole }).role || "global_admin",
    mustChangePassword: Boolean(admin.mustChangePassword),
    lastLoginAt: admin.lastLoginAt?.toISOString() ?? null,
  };
}

export async function requirePlatformSession() {
  const session = await getPlatformSession();
  if (!session) throw new Error("Unauthorized");
  return session;
}
