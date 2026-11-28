import { NextResponse } from "next/server";
import { db } from "@/src/prisma/db";
import { requireAdmin } from "@/src/lib/admin-auth";

// The last quiz question check, so results survive a reload.
const KEY = "questionCheck:last";

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;
  const row = await db.orm.public.AdminSetting.where({ key: KEY }).first();
  let saved: unknown = null;
  try {
    saved = row ? JSON.parse(row.value) : null;
  } catch {
    saved = null;
  }
  return NextResponse.json({ saved });
}

export async function POST(request: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const b = await request.json().catch(() => null);
  if (!b || !Array.isArray(b.results)) return NextResponse.json({ error: "Expected results." }, { status: 400 });
  const value = JSON.stringify({ at: new Date().toISOString(), results: b.results.slice(0, 200) });
  const existing = await db.orm.public.AdminSetting.where({ key: KEY }).first();
  if (existing) await db.orm.public.AdminSetting.where({ id: existing.id }).update({ value });
  else await db.orm.public.AdminSetting.create({ key: KEY, value });
  return NextResponse.json({ ok: true });
}
