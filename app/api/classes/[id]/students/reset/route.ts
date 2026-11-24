import { NextResponse } from "next/server";
import { db } from "@/src/prisma/db";
import { getCurrentTeacher } from "@/src/lib/current-teacher";

// Clears a student's password so they create a new one at their next
// sign-in. Only for students enrolled in one of this teacher's classes.
export async function POST(request: Request, ctx: RouteContext<"/api/classes/[id]/students/reset">) {
  const teacher = await getCurrentTeacher();
  if (!teacher) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const classId = Number((await ctx.params).id);
  const cls = await db.orm.public.Class.where({ id: classId, teacherId: teacher.id }).select("id").first();
  if (!cls) return NextResponse.json({ error: "Class not found." }, { status: 404 });

  const body = await request.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const enrolled = await db.orm.public.Enrollment.where({ classId, studentEmail: email }).select("id").first();
  if (!enrolled) return NextResponse.json({ error: "That student isn't in this class." }, { status: 404 });

  const account = await db.orm.public.Student.where({ email }).select("id").first();
  if (account) await db.orm.public.Student.where({ id: account.id }).update({ passwordHash: null });
  return NextResponse.json({ ok: true });
}
