import { NextResponse } from "next/server";
import { db } from "@/src/prisma/db";
import { getCurrentStudentSession } from "@/src/lib/student-auth";

export async function GET() {
  const session = await getCurrentStudentSession();
  if (!session) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const enrollments = await db.orm.public.Enrollment
    .where({ studentEmail: session.email })
    .orderBy((e) => e.createdAt.desc())
    .all();

  const classes = [];
  for (const enrollment of enrollments) {
    const cls = await db.orm.public.Class
      .where({ id: enrollment.classId })
      .select("id", "name", "quizOpen")
      .first();
    if (!cls) continue;

    const submission = await db.orm.public.Submission
      .where({ classId: cls.id, studentEmail: session.email })
      .select("id", "status", "quiz", "quizAnswers", "studentResponse")
      .first();

    classes.push({
      ...cls,
      submission: submission
        ? {
            id: submission.id,
            status: submission.status,
            hasQuiz: submission.quiz != null,
            hasAnswers: submission.quizAnswers != null,
            hasResponded: submission.studentResponse != null,
          }
        : null,
    });
  }

  return NextResponse.json({ student: session, classes });
}
