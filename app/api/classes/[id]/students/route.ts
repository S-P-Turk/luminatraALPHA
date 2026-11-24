import { NextResponse } from "next/server";
import { db } from "@/src/prisma/db";
import { getCurrentTeacher } from "@/src/lib/current-teacher";

// The class roster: who has joined, and whether each student has set a password.
export async function GET(_request: Request, ctx: RouteContext<"/api/classes/[id]/students">) {
  const teacher = await getCurrentTeacher();
  if (!teacher) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const classId = Number((await ctx.params).id);
  const cls = await db.orm.public.Class.where({ id: classId, teacherId: teacher.id }).select("id").first();
  if (!cls) return NextResponse.json({ error: "Class not found." }, { status: 404 });

  const enrollments = await db.orm.public.Enrollment
    .where({ classId })
    .orderBy((e) => e.createdAt.asc())
    .select("studentName", "studentEmail", "createdAt")
    .all();

  const students = [];
  for (const e of enrollments) {
    const account = await db.orm.public.Student.where({ email: e.studentEmail }).select("passwordHash").first();
    students.push({
      name: e.studentName,
      email: e.studentEmail,
      joinedAt: e.createdAt,
      hasPassword: Boolean(account?.passwordHash),
    });
  }
  return NextResponse.json({ students });
}
