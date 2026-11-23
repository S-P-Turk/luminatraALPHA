import { NextResponse } from "next/server";
import { db } from "@/src/prisma/db";
import { getCurrentStudentSession } from "@/src/lib/student-auth";
import { forStudent } from "@/src/lib/grading";

export async function GET(_request: Request, ctx: RouteContext<"/api/student/assignments/[id]">) {
  const session = await getCurrentStudentSession();
  if (!session) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const { id: idParam } = await ctx.params;
  const id = Number(idParam);
  if (!Number.isInteger(id)) {
    return NextResponse.json({ error: "Invalid assignment id." }, { status: 400 });
  }

  const assignment = await db.orm.public.Assignment.where({ id }).first();
  if (!assignment) {
    return NextResponse.json({ error: "Assignment not found." }, { status: 404 });
  }

  const enrollment = await db.orm.public.Enrollment
    .where({ classId: assignment.classId, studentEmail: session.email })
    .first();
  if (!enrollment) {
    return NextResponse.json({ error: "You haven't joined this class." }, { status: 403 });
  }

  const cls = await db.orm.public.Class
    .where({ id: assignment.classId })
    .select("id", "name")
    .first();

  const submission = await db.orm.public.Submission
    .where({ assignmentId: id, studentEmail: session.email })
    .first();

  // Don't send the quiz questions until the teacher activates the quiz, so
  // students can't read them ahead of time.
  const visibleSubmission =
    submission && !assignment.quizOpen && submission.quiz
      ? { ...submission, quiz: { ...(submission.quiz as object), quiz: [] } }
      : submission;

  return NextResponse.json({
    student: session,
    class: cls,
    assignment: {
      id: assignment.id,
      title: assignment.title,
      instructions: assignment.instructions,
      open: assignment.open,
      quizOpen: assignment.quizOpen,
    },
    submission: visibleSubmission ? forStudent(visibleSubmission) : null,
  });
}
