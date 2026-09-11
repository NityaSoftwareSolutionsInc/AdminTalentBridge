import { SignJWT, jwtVerify } from "jose";
import type { NextResponse } from "next/server";

export const SESSION_COOKIE = "tb_platform_session";
export const SESSION_MAX_AGE_SEC = 60 * 60 * 12;

export type PlatformSessionClaims = {
  platformAdminId: string;
};

function jwtSecret() {
  const raw = process.env.AUTH_JWT_SECRET || "";
  if (raw.length < 16) {
    throw new Error("AUTH_JWT_SECRET must be at least 16 characters");
  }
  return new TextEncoder().encode(raw);
}

export function sessionCookieOptions(maxAge = SESSION_MAX_AGE_SEC) {
  return {
    httpOnly: true,
    path: "/",
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    maxAge,
  };
}

export function clearSessionCookie(res: NextResponse) {
  res.cookies.set(SESSION_COOKIE, "", {
    ...sessionCookieOptions(0),
    expires: new Date(0),
  });
}

export async function signPlatformToken(claims: PlatformSessionClaims) {
  return new SignJWT({ platform_admin_id: claims.platformAdminId })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(claims.platformAdminId)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_SEC}s`)
    .sign(jwtSecret());
}

export async function verifyPlatformToken(token: string): Promise<PlatformSessionClaims | null> {
  try {
    const { payload } = await jwtVerify(token, jwtSecret(), { algorithms: ["HS256"] });
    const platformAdminId = String(payload.sub || payload.platform_admin_id || "");
    if (!platformAdminId) return null;
    return { platformAdminId };
  } catch {
    return null;
  }
}
