import { NextResponse } from "next/server";
import { db } from "@/src/prisma/db";
import { getCurrentStudentSession } from "@/src/lib/student-auth";
import { forStudent } from "@/src/lib/grading";
import { ensureQuizQuestions, ANALYZING, ANALYSIS_FAILED } from "@/src/lib/analyze";
import { ensureRulesCard, rulesForStudent } from "@/src/lib/rules";

export const maxDuration = 60;

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

  let submission = await db.orm.public.Submission
    .where({ assignmentId: id, studentEmail: session.email })
    .first();

  // An analysis still marked as running after 4 minutes was cut off (a
  // deploy or a server timeout). Mark it failed so the student gets the
  // free "Try again" button instead of a spinner that never ends.
  if (submission?.status === ANALYZING && Date.now() - new Date(submission.updatedAt as unknown as string).getTime() > 4 * 60_000) {
    await db.orm.public.Submission.where({ id: submission.id }).update({
      status: ANALYSIS_FAILED,
      reportCard: { error: "The analysis was interrupted." },
    });
    submission = await db.orm.public.Submission.where({ id: submission.id }).first();
  }

  // The quiz is written after the score. If the teacher has opened the quiz
  // and the questions aren't there yet, write them now.
  const questions = (submission?.quiz as { quiz?: unknown[] } | null)?.quiz;
  if (submission && assignment.quizOpen && submission.status !== "analyzing" && submission.quiz && !(Array.isArray(questions) && questions.length)) {
    try {
      await ensureQuizQuestions(submission.id);
      submission = await db.orm.public.Submission.where({ id: submission.id }).first();
    } catch {
      // The page shows "preparing your quiz" and tries again on the next load.
    }
  }

  // Don't send the quiz questions until the teacher activates the quiz, so
  // students can't read them ahead of time.
  const visibleSubmission =
    submission && !assignment.quizOpen && submission.quiz
      ? { ...submission, quiz: { ...(submission.quiz as object), quiz: [] } }
      : submission;

  const rules = assignment.open ? rulesForStudent(await ensureRulesCard(assignment)) : null;

  return NextResponse.json({
    student: session,
    rules,
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
