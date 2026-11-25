import { NextResponse } from "next/server";
import { db } from "@/src/prisma/db";
import { getCurrentStudentSession } from "@/src/lib/student-auth";
import { after } from "next/server";
import { forStudent, MAX_REVISIONS } from "@/src/lib/grading";
import { analyzeSubmission, ANALYZING, ANALYSIS_FAILED } from "@/src/lib/analyze";

// The analysis runs after the response is sent; this is its time budget.
export const maxDuration = 300;

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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected JSON body." }, { status: 400 });
  }
  const field = (k: string) => {
    const v = (body as Record<string, unknown> | null)?.[k];
    return typeof v === "string" ? v.trim() : "";
  };

  // Retry a failed analysis on the stored text. Doesn't use a revision.
  if ((body as { retry?: unknown })?.retry === true) {
    if (!existing || existing.status !== ANALYSIS_FAILED) {
      return NextResponse.json({ error: "There's nothing to retry." }, { status: 400 });
    }
    await db.orm.public.Submission.where({ id: existing.id }).update({ status: ANALYZING, reportCard: null });
    after(() => analyzeSubmission(existing.id));
    return NextResponse.json({ submission: forStudent({ ...existing, status: ANALYZING, reportCard: null }) }, { status: 202 });
  }

  const assignmentText = field("assignmentText");
  if (!assignmentText) {
    return NextResponse.json({ error: "Paste the assignment text you're submitting." }, { status: 400 });
  }
  if (assignmentText.length > 20000) {
    return NextResponse.json({ error: "Your assignment is too long. Trim it and try again." }, { status: 400 });
  }

  if (!existing) {
    const transcript = field("transcript");
    if (!transcript) {
      return NextResponse.json({ error: "Paste your AI conversation transcript (or state you used none)." }, { status: 400 });
    }
    if (transcript.length > 40000) {
      return NextResponse.json({ error: "Your transcript is too long. Trim it and try again." }, { status: 400 });
    }
    const created = await db.orm.public.Submission.create({
      assignmentId: id,
      classId: assignment.classId,
      studentName: session.name,
      studentEmail: session.email,
      assignmentText,
      transcript,
      status: ANALYZING,
    });
    after(() => analyzeSubmission(created.id));
    return NextResponse.json({ submission: forStudent(created) }, { status: 202 });
  }

  // A revision: allowed while the assignment is open, before the quiz starts,
  // up to MAX_REVISIONS times. The assignment text can be replaced, but the
  // AI chat is append-only: the original transcript can't be edited or
  // removed, only added to. Every earlier version is kept for the teacher.
  const priorRevisions = Array.isArray(existing.revisions) ? (existing.revisions as unknown[]) : [];
  const blocked =
    existing.status === ANALYZING
      ? "Your last submission is still being analyzed. Wait for the result first."
      : assignment.quizOpen || existing.quizAnswers != null
        ? "The quiz has started, so this submission can't be revised now."
        : priorRevisions.length >= MAX_REVISIONS
          ? `You've used all ${MAX_REVISIONS} revisions for this assignment.`
          : null;
  if (blocked) {
    return NextResponse.json({ error: blocked, submission: forStudent(existing) }, { status: 409 });
  }

  const added = field("addedTranscript");
  const transcript = added
    ? `${existing.transcript}\n\n--- Additional AI conversation added with revision ${priorRevisions.length + 1} (${new Date().toISOString().slice(0, 10)}) ---\n${added}`
    : existing.transcript;
  if (transcript.length > 80000) {
    return NextResponse.json({ error: "The added conversation is too long. Trim it and try again." }, { status: 400 });
  }

  const prevScore = ((existing.reportCard ?? {}) as { scoreCard?: { score?: number } }).scoreCard?.score ?? null;
  const revisions = [
    ...priorRevisions,
    {
      at: new Date(existing.updatedAt ?? existing.createdAt).toISOString(),
      score: prevScore,
      assignmentText: existing.assignmentText,
      transcript: existing.transcript,
      addedChat: !!added,
    },
  ];
  await db.orm.public.Submission.where({ id: existing.id }).update({
    assignmentText,
    transcript,
    quiz: null,
    reportCard: null,
    status: ANALYZING,
    studentResponse: null,
    revisions: revisions as never,
  });
  after(() => analyzeSubmission(existing.id));
  const updated = await db.orm.public.Submission.where({ id: existing.id }).first();
  return NextResponse.json({ submission: updated ? forStudent(updated) : null }, { status: 202 });
}
