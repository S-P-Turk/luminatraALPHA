import { NextResponse } from "next/server";
import { db } from "@/src/prisma/db";
import { requireAdmin } from "@/src/lib/admin-auth";

export async function DELETE(_request: Request, ctx: RouteContext<"/api/admin/lab/cases/[id]">) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const id = Number((await ctx.params).id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: "Invalid id." }, { status: 400 });
  await db.orm.public.LabCase.where({ id }).delete();
  return NextResponse.json({ ok: true });
}
