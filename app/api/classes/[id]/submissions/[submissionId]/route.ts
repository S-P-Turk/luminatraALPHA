import { NextResponse } from "next/server";
import { db } from "@/src/prisma/db";
import { getCurrentTeacher } from "@/src/lib/current-teacher";

// Records the teacher's decision on a submission: "cleared" (no follow-up
// needed) or "follow_up" (they'll talk to the student). These decisions are
// the labels used to measure and tune the scoring layer.
export async function PATCH(
  request: Request,
  ctx: RouteContext<"/api/classes/[id]/submissions/[submissionId]">
) {
  const teacher = await getCurrentTeacher();
  if (!teacher) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const { id: idParam, submissionId: submissionIdParam } = await ctx.params;
  const classId = Number(idParam);
  const submissionId = Number(submissionIdParam);
  if (!Number.isInteger(classId) || !Number.isInteger(submissionId)) {
    return NextResponse.json({ error: "Invalid id." }, { status: 400 });
  }

  const cls = await db.orm.public.Class.where({ id: classId, teacherId: teacher.id }).first();
  if (!cls) {
    return NextResponse.json({ error: "Class not found." }, { status: 404 });
  }

  const submission = await db.orm.public.Submission.where({ id: submissionId, classId }).first();
  if (!submission) {
    return NextResponse.json({ error: "Submission not found." }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected JSON body." }, { status: 400 });
  }

  const status = (body as { status?: unknown })?.status;
  if (status !== "cleared" && status !== "follow_up") {
    return NextResponse.json({ error: "status must be 'cleared' or 'follow_up'." }, { status: 400 });
  }

  const updated = await db.orm.public.Submission
    .where({ id: submissionId })
    .select(
      "id",
      "assignmentId",
      "studentName",
      "studentEmail",
      "quiz",
      "quizAnswers",
      "reportCard",
      "studentResponse",
      "status",
      "createdAt",
      "updatedAt"
    )
    .update({ status });

  return NextResponse.json({ submission: updated });
}
