import { NextResponse, connection } from "next/server";
import { adminConfigured, isAdmin } from "@/src/lib/admin-auth";

export async function GET() {
  // Always per-request: the answer depends on the caller's cookie.
  await connection();
  return NextResponse.json({ admin: await isAdmin(), configured: adminConfigured() });
}
