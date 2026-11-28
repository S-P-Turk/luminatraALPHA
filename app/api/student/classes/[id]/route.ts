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

  const cls = await db.orm.public.Class.where({ id }).select("id", "name").first();
  if (!cls) {
    return NextResponse.json({ error: "Class not found." }, { status: 404 });
  }

  const assignments = await db.orm.public.Assignment
    .where({ classId: id })
    .orderBy((a) => a.createdAt.desc())
    .all();

  const result = [];
  for (const a of assignments) {
    const submission = await db.orm.public.Submission
      .where({ assignmentId: a.id, studentEmail: session.email })
      .select("id", "status", "quiz", "quizAnswers", "studentResponse")
      .first();

    result.push({
      id: a.id,
      title: a.title,
      open: a.open,
      quizOpen: a.quizOpen,
      submission: submission
        ? {
            id: submission.id,
            status: submission.status,
            hasQuiz: submission.quiz != null,
            hasAnswers: submission.quizAnswers != null,
            hasResponded: submission.studentResponse != null,
          }
        : null,
    });
  }

  return NextResponse.json({ class: cls, assignments: result });
}

// Leaves a class. Only the enrollment goes: submissions stay with the teacher
// as the course record, and reappear if the student rejoins with the code.
export async function DELETE(_request: Request, ctx: RouteContext<"/api/student/classes/[id]">) {
  const session = await getCurrentStudentSession();
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const classId = Number((await ctx.params).id);
  if (!Number.isInteger(classId)) return NextResponse.json({ error: "Invalid class id." }, { status: 400 });

  const removed = await db.orm.public.Enrollment.where({ classId, studentEmail: session.email }).deleteAndCount();
  if (!removed) return NextResponse.json({ error: "You're not in this class." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
