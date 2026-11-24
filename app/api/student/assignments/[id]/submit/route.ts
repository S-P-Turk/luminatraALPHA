import { NextResponse } from "next/server";
import { db } from "@/src/prisma/db";
import { getCurrentStudentSession } from "@/src/lib/student-auth";
import { generateQuiz } from "@/src/lib/quiz";
import { scoreSubmission } from "@/src/lib/scoring";
import { withAiContext } from "@/src/lib/ai";
import { nextStatus, forStudent } from "@/src/lib/grading";

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
  if (existing) {
    return NextResponse.json(
      { error: "You've already submitted this assignment.", submission: forStudent(existing) },
      { status: 409 }
    );
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
