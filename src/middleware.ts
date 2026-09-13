import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE, verifyPlatformToken } from "@/lib/jwt";

const PUBLIC_PATHS = [
  "/login",
  "/set-password",
  "/api/login",
  "/api/logout",
  "/api/forgot-password",
  "/api/password",
];

function isPublicAsset(pathname: string) {
  return (
    pathname === "/icon" ||
    pathname === "/icon.svg" ||
    pathname === "/icon-32.png" ||
    pathname === "/apple-icon" ||
    pathname === "/apple-touch-icon.png" ||
    pathname === "/opengraph-image" ||
    pathname === "/twitter-image" ||
    pathname === "/favicon.ico"
  );
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (
    pathname.startsWith("/_next") ||
    isPublicAsset(pathname) ||
    PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))
  ) {
    return NextResponse.next();
  }

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token || !(await verifyPlatformToken(token))) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const login = new URL("/login", req.url);
    return NextResponse.redirect(login);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
