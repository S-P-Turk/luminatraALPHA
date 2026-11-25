import { NextResponse } from "next/server";
import { db } from "@/src/prisma/db";
import { getCurrentStudentSession } from "@/src/lib/student-auth";
import { generateQuiz } from "@/src/lib/quiz";
import { scoreSubmission } from "@/src/lib/scoring";
import { withAiContext } from "@/src/lib/ai";
import { nextStatus, forStudent, MAX_REVISIONS } from "@/src/lib/grading";

export async function POST(request: Request, ctx: RouteContext<"/api/student/assignments/[id]/submit">) {
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
  if (!assignment.open) {
    return NextResponse.json({ error: "This assignment isn't open for submissions yet." }, { status: 400 });
  }

  const existing = await db.orm.public.Submission
    .where({ assignmentId: id, studentEmail: session.email })
    .first();
  // A student may revise after seeing their score, while the assignment is
  // open, before the quiz starts, and up to MAX_REVISIONS times. Each earlier
  // version is kept so the teacher can see what changed.
  const priorRevisions = Array.isArray(existing?.revisions) ? (existing.revisions as unknown[]) : [];
  if (existing) {
    const reason = assignment.quizOpen || existing.quizAnswers != null
      ? "The quiz has started, so this submission can't be revised now."
      : priorRevisions.length >= MAX_REVISIONS
        ? `You've used all ${MAX_REVISIONS} revisions for this assignment.`
        : null;
    if (reason) {
      return NextResponse.json({ error: reason, submission: forStudent(existing) }, { status: 409 });
    }
  }

  const cls = await db.orm.public.Class.where({ id: assignment.classId }).first();
  if (!cls) {
    return NextResponse.json({ error: "Class not found." }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected JSON body." }, { status: 400 });
  }

  const assignmentText = typeof (body as { assignmentText?: unknown })?.assignmentText === "string"
    ? (body as { assignmentText: string }).assignmentText.trim()
    : "";
  const transcript = typeof (body as { transcript?: unknown })?.transcript === "string"
    ? (body as { transcript: string }).transcript.trim()
    : "";

  if (!assignmentText) {
    return NextResponse.json({ error: "Paste the assignment text you're submitting." }, { status: 400 });
  }
  if (!transcript) {
    return NextResponse.json({ error: "Paste your AI conversation transcript (or state you used none)." }, { status: 400 });
  }
  if (assignmentText.length > 20000 || transcript.length > 40000) {
    return NextResponse.json({ error: "That's too long — trim it down and try again." }, { status: 400 });
  }

  // The class syllabus is the source of AI-use rules; the assignment's own
  // instructions tell the model what this particular piece of work actually
  // asked for, so the comprehension quiz can target the right claims.
  const combinedPolicy = `COURSE SYLLABUS / AI-USE POLICY:\n${cls.syllabusText}\n\n---\n\nTHIS ASSIGNMENT'S INSTRUCTIONS:\n${assignment.title}\n${assignment.instructions}`;

  let quiz;
  try {
    quiz = await withAiContext({ classId: assignment.classId }, () =>
      generateQuiz(transcript, combinedPolicy, assignmentText)
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Could not generate your quiz.";
    return NextResponse.json({ error: msg }, { status: 502 });
  }

  const scoreCard = scoreSubmission({ quiz, submissionText: assignmentText, transcript });
  const status = nextStatus("submitted", scoreCard, false);

  if (existing) {
    const prevScore = ((existing.reportCard ?? {}) as { scoreCard?: { score?: number } }).scoreCard?.score ?? null;
    const revisions = [
      ...priorRevisions,
      { at: new Date(existing.updatedAt ?? existing.createdAt).toISOString(), score: prevScore, assignmentText: existing.assignmentText, transcript: existing.transcript },
    ];
    await db.orm.public.Submission.where({ id: existing.id }).update({
      assignmentText,
      transcript,
      quiz,
      reportCard: { scoreCard },
      status,
      studentResponse: null,
      revisions: revisions as never,
    });
    const updated = await db.orm.public.Submission.where({ id: existing.id }).first();
    return NextResponse.json({ submission: updated ? forStudent(updated) : null });
  }

  const created = await db.orm.public.Submission.create({
    assignmentId: id,
    classId: assignment.classId,
    studentName: session.name,
    studentEmail: session.email,
    assignmentText,
    transcript,
    quiz,
    reportCard: { scoreCard },
    status,
  });

  return NextResponse.json({ submission: forStudent(created) }, { status: 201 });
}
