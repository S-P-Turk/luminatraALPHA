import { NextResponse } from "next/server";
import { db } from "@/src/prisma/db";
import { getCurrentStudentSession } from "@/src/lib/student-auth";

// A flagged submission is shown to the student before the teacher sees it —
// this is where they can add context/justification in response.
export async function POST(request: Request, ctx: RouteContext<"/api/student/classes/[id]/respond">) {
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

  const studentResponse = typeof (body as { studentResponse?: unknown })?.studentResponse === "string"
    ? (body as { studentResponse: string }).studentResponse.trim()
    : "";
  if (!studentResponse) {
    return NextResponse.json({ error: "Enter a response." }, { status: 400 });
  }
  if (studentResponse.length > 4000) {
    return NextResponse.json({ error: "Keep it under 4,000 characters." }, { status: 400 });
  }

  const updated = await db.orm.public.Submission
    .where({ id: submission.id })
    .update({ studentResponse });

  return NextResponse.json({ submission: updated });
}
