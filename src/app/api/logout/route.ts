import { NextResponse } from "next/server";
import { clearSessionCookie } from "@/lib/jwt";

export async function POST(req: Request) {
  const res = req.headers.get("accept")?.includes("text/html")
    ? NextResponse.redirect(new URL("/login", req.url))
    : NextResponse.json({ ok: true });
  clearSessionCookie(res);
  return res;
}

export async function GET(req: Request) {
  const res = NextResponse.redirect(new URL("/login", req.url));
  clearSessionCookie(res);
  return res;
}
