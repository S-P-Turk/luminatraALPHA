import { NextResponse } from "next/server";
import { db } from "@/src/prisma/db";
import { getCurrentStudentSession } from "@/src/lib/student-auth";
import { gradeIfNeeded } from "@/src/lib/grading";

export async function POST(request: Request, ctx: RouteContext<"/api/student/assignments/[id]/answer">) {
  const session = await getCurrentStudentSession();
  if (!session) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const { id: idParam } = await ctx.params;
  const id = Number(idParam);
  if (!Number.isInteger(id)) {
    return NextResponse.json({ error: "Invalid assignment id." }, { status: 400 });
  }

  const submission = await db.orm.public.Submission
    .where({ assignmentId: id, studentEmail: session.email })
    .first();
  if (!submission) {
    return NextResponse.json({ error: "No submission found for this assignment." }, { status: 404 });
  }

  const assignment = await db.orm.public.Assignment.where({ id }).select("quizOpen").first();
  if (!assignment?.quizOpen) {
    return NextResponse.json({ error: "Your teacher hasn't started the quiz yet." }, { status: 400 });
  }
  if (submission.quizAnswers != null) {
    return NextResponse.json({ error: "You've already answered this quiz." }, { status: 409 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected JSON body." }, { status: 400 });
  }

  const answers = (body as { answers?: unknown })?.answers;
  if (!Array.isArray(answers) || !answers.every((a) => typeof a === "string")) {
    return NextResponse.json({ error: "answers must be a list of strings." }, { status: 400 });
  }

  await db.orm.public.Submission.where({ id: submission.id }).update({ quizAnswers: answers });

  // Grade right away so a failed comprehension check is flagged (and the
  // student is asked to explain) before the teacher sees it.
  const graded = await gradeIfNeeded({ ...submission, quizAnswers: answers });

  return NextResponse.json({
    submission: { ...submission, quizAnswers: answers, reportCard: graded.reportCard, status: graded.status },
  });
}
