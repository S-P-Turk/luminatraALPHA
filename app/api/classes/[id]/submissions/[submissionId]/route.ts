import { NextResponse } from "next/server";
import { db } from "@/src/prisma/db";
import { getCurrentTeacher } from "@/src/lib/current-teacher";

// Lets a teacher dismiss a flagged submission (mark it cleared) once they've
// reviewed it and decided it's not actually a problem.
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
  if (status !== "cleared") {
    return NextResponse.json({ error: "status must be 'cleared'." }, { status: 400 });
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
    .update({ status: "cleared" });

  return NextResponse.json({ submission: updated });
}
