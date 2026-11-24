import { NextResponse } from "next/server";
import { ADMIN_COOKIE, adminConfigured, checkAdminPassword } from "@/src/lib/admin-auth";

export async function POST(request: Request) {
  if (!adminConfigured()) {
    return NextResponse.json({ error: "Admin access isn't set up on this deployment." }, { status: 503 });
  }
  const body = await request.json().catch(() => null);
  const password = typeof body?.password === "string" ? body.password : "";
  const token = checkAdminPassword(password);
  if (!token) {
    return NextResponse.json({ error: "Wrong password." }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}
