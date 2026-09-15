import { NextResponse } from "next/server";
import { clearSessionCookie } from "@/lib/jwt";
import { resolvePublicOrigin } from "@/lib/public-origin";

export async function POST(req: Request) {
  const origin = resolvePublicOrigin(req);
  const res = req.headers.get("accept")?.includes("text/html")
    ? NextResponse.redirect(new URL("/login", origin))
    : NextResponse.json({ ok: true });
  clearSessionCookie(res);
  return res;
}

export async function GET(req: Request) {
  const origin = resolvePublicOrigin(req);
  const res = NextResponse.redirect(new URL("/login", origin));
  clearSessionCookie(res);
  return res;
}
