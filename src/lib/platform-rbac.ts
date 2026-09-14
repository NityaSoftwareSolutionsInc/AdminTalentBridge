export type PlatformRole = "global_admin" | "manager" | "support";

type SessionLike = {
  platformAdminId: string;
  role: PlatformRole;
};

export class PlatformForbiddenError extends Error {
  constructor(message = "You do not have permission to do that") {
    super(message);
    this.name = "PlatformForbiddenError";
  }
}

export const PLATFORM_ROLE_LABEL: Record<PlatformRole, string> = {
  global_admin: "Global Admin",
  manager: "Manager",
  support: "Support",
};

export function parsePlatformRole(value: unknown): PlatformRole | null {
  if (value === "global_admin" || value === "manager" || value === "support") return value;
  return null;
}

export function isGlobalAdmin(session: SessionLike) {
  return session.role === "global_admin";
}

export function canCreateTenant(session: SessionLike) {
  return session.role === "global_admin" || session.role === "manager";
}

export function canMutateTenant(session: SessionLike, createdById: string | null | undefined) {
  if (session.role === "global_admin") return true;
  if (session.role === "manager") return createdById === session.platformAdminId;
  return false;
}

export function canSupportAccess(session: SessionLike) {
  return session.role === "global_admin" || session.role === "support";
}

export function canManagePlatformUsers(session: SessionLike) {
  return session.role === "global_admin";
}

export function canViewTickets(session: SessionLike) {
  return (
    session.role === "global_admin" || session.role === "manager" || session.role === "support"
  );
}

export function canMutateTickets(session: SessionLike) {
  return session.role === "global_admin" || session.role === "support";
}

export function canViewAudit(session: SessionLike) {
  return session.role === "global_admin" || session.role === "manager";
}

export function canViewEmailLogs(session: SessionLike) {
  return session.role === "global_admin";
}

export function defaultNavForRole(role: PlatformRole): "dashboard" | "tickets" {
  return role === "support" ? "tickets" : "dashboard";
}

export function assertCanCreateTenant(session: SessionLike) {
  if (!canCreateTenant(session)) {
    throw new PlatformForbiddenError("Support cannot create tenants");
  }
}

export function assertCanMutateTenant(session: SessionLike, createdById: string | null | undefined) {
  if (!canMutateTenant(session, createdById)) {
    throw new PlatformForbiddenError("You can only change tenants you created");
  }
}

export function assertCanSupportAccess(session: SessionLike) {
  if (!canSupportAccess(session)) {
    throw new PlatformForbiddenError("Only Support and Global Admin can open tenant support access");
  }
}

export function assertCanManagePlatformUsers(session: SessionLike) {
  if (!canManagePlatformUsers(session)) {
    throw new PlatformForbiddenError("Only Global Admin can manage platform users");
  }
}

export function assertCanViewTickets(session: SessionLike) {
  if (!canViewTickets(session)) {
    throw new PlatformForbiddenError();
  }
}

export function assertCanMutateTickets(session: SessionLike) {
  if (!canMutateTickets(session)) {
    throw new PlatformForbiddenError("Managers can view tickets on their tenants but cannot update them");
  }
}

export function assertCanViewAudit(session: SessionLike) {
  if (!canViewAudit(session)) {
    throw new PlatformForbiddenError();
  }
}

export function assertCanViewEmailLogs(session: SessionLike) {
  if (!canViewEmailLogs(session)) {
    throw new PlatformForbiddenError();
  }
}

export function forbiddenResponse(e: unknown) {
  if (e instanceof PlatformForbiddenError) {
    return { error: e.message, status: 403 as const };
  }
  return null;
}
