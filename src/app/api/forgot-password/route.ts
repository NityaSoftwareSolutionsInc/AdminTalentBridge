import { NextResponse } from "next/server";
import { requestPlatformAdminForgotPassword } from "@/lib/platform-mail";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { email?: string };
    const origin = req.headers.get("origin");
    const result = await requestPlatformAdminForgotPassword(String(body.email || ""), origin);
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({
      ok: true,
      message: "If that email is a Global Admin account, a reset link has been sent.",
    });
  }
}
