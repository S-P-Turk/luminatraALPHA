import { NextResponse } from "next/server";
import { db } from "@/src/prisma/db";
import { getCurrentStudentSession } from "@/src/lib/student-auth";
import { generateQuiz } from "@/src/lib/quiz";

export async function POST(request: Request, ctx: RouteContext<"/api/student/classes/[id]/submit">) {
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

  const cls = await db.orm.public.Class.where({ id }).first();
  if (!cls) {
    return NextResponse.json({ error: "Class not found." }, { status: 404 });
  }
  if (!cls.quizOpen) {
    return NextResponse.json({ error: "Your teacher hasn't opened submissions for this class yet." }, { status: 400 });
  }

  const existing = await db.orm.public.Submission
    .where({ classId: id, studentEmail: session.email })
    .first();
  if (existing) {
    return NextResponse.json(
      { error: "You've already submitted for this class.", submission: existing },
      { status: 409 }
    );
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

  let quiz;
  try {
    quiz = await generateQuiz(transcript, cls.syllabusText);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Could not generate your quiz.";
    return NextResponse.json({ error: msg }, { status: 502 });
  }

  // A flagged policy mismatch goes to the student first, not straight to
  // the teacher — they get a chance to add context before it lands on the
  // teacher's review queue.
  const status = quiz.policy_concern ? "flagged" : "submitted";

  const created = await db.orm.public.Submission.create({
    classId: id,
    studentName: session.name,
    studentEmail: session.email,
    assignmentText,
    transcript,
    quiz,
    status,
  });

  return NextResponse.json({ submission: created }, { status: 201 });
}
