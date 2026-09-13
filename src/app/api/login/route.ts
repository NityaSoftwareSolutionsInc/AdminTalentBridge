import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { SESSION_COOKIE, sessionCookieOptions, signPlatformToken } from "@/lib/jwt";
import { verifyPassword } from "@/lib/password";
import {
  applyFailedPlatformLogin,
  applySuccessfulPlatformLogin,
} from "@/lib/platform-admins";

export async function POST(req: Request) {
  const body = (await req.json()) as { email?: string; password?: string };
  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "");
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "";

  if (!email || !password) {
    return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
  }

  const admin = await prisma.platformAdmin.findFirst({ where: { email } });
  if (!admin || !admin.enabled) {
    await applyFailedPlatformLogin(admin?.id || null, email);
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  }

  if (admin.lockedUntil && admin.lockedUntil > new Date()) {
    await applyFailedPlatformLogin(admin.id, email);
    return NextResponse.json(
      { error: "Account temporarily locked after failed sign-in attempts. Try again later." },
      { status: 423 },
    );
  }

  const ok = await verifyPassword(password, admin.passwordHash);
  if (!ok) {
    await applyFailedPlatformLogin(admin.id, email);
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  }

  await applySuccessfulPlatformLogin(admin.id, email, ip);
  const token = await signPlatformToken({ platformAdminId: admin.id });
  const res = NextResponse.json({
    ok: true,
    name: admin.name,
    mustChangePassword: Boolean(admin.mustChangePassword),
  });
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
  return res;
}
