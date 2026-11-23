import { NextResponse } from "next/server";
import { db } from "@/src/prisma/db";
import { getCurrentStudentSession } from "@/src/lib/student-auth";

export async function POST(request: Request, ctx: RouteContext<"/api/student/classes/[id]/answer">) {
  const session = await getCurrentStudentSession();
  if (!session) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const { id: idParam } = await ctx.params;
  const id = Number(idParam);
  if (!Number.isInteger(id)) {
    return NextResponse.json({ error: "Invalid class id." }, { status: 400 });
  }

  const submission = await db.orm.public.Submission
    .where({ classId: id, studentEmail: session.email })
    .first();
  if (!submission) {
    return NextResponse.json({ error: "No submission found for this class." }, { status: 404 });
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

  const updated = await db.orm.public.Submission
    .where({ id: submission.id })
    .update({ quizAnswers: answers });

  return NextResponse.json({ submission: updated });
}
