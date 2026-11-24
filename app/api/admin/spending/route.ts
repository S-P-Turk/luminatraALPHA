import { NextResponse } from "next/server";
import { requireAdmin } from "@/src/lib/admin-auth";
import { spendingData } from "@/src/lib/admin-data";

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;
  return NextResponse.json(await spendingData());
}
