import { NextResponse } from "next/server";
import { db } from "@/src/prisma/db";
import { getCurrentStudentSession } from "@/src/lib/student-auth";

export async function GET(_request: Request, ctx: RouteContext<"/api/student/classes/[id]">) {
  const session = await getCurrentStudentSession();
  if (!session) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const { id: idParam } = await ctx.params;
  const id = Number(idParam);
  if (!Number.isInteger(id)) {
    return NextResponse.json({ error: "Invalid class id." }, { status: 400 });
  }

  const enrollment = await db.orm.public.Enrollment
    .where({ classId: id, studentEmail: session.email })
    .first();
  if (!enrollment) {
    return NextResponse.json({ error: "You haven't joined this class." }, { status: 403 });
  }

  const cls = await db.orm.public.Class
    .where({ id })
    .select("id", "name", "quizOpen")
    .first();
  if (!cls) {
    return NextResponse.json({ error: "Class not found." }, { status: 404 });
  }

  const submission = await db.orm.public.Submission
    .where({ classId: id, studentEmail: session.email })
    .first();

  return NextResponse.json({ student: session, class: cls, submission: submission ?? null });
}
