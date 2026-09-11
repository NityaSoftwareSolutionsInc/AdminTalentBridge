import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { SESSION_COOKIE, sessionCookieOptions, signPlatformToken } from "@/lib/jwt";
import { verifyPassword } from "@/lib/password";

export async function POST(req: Request) {
  const body = (await req.json()) as { email?: string; password?: string };
  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "");

  if (!email || !password) {
    return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
  }

  const admin = await prisma.platformAdmin.findFirst({
    where: { email, enabled: true },
  });
  const ok = admin && (await verifyPassword(password, admin.passwordHash));
  if (!ok || !admin) {
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  }

  const token = await signPlatformToken({ platformAdminId: admin.id });
  const res = NextResponse.json({ ok: true, name: admin.name });
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
  return res;
}
