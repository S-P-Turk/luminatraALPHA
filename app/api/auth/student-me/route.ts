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
      .select("id", "name")
      .first();
    if (!cls) continue;

    const assignments = await db.orm.public.Assignment
      .where({ classId: cls.id })
      .select("id", "open", "quizOpen")
      .all();

    let openUnsubmitted = 0;
    let needsResponse = 0;
    let needsAnswers = 0;
    for (const a of assignments) {
      const submission = await db.orm.public.Submission
        .where({ assignmentId: a.id, studentEmail: session.email })
        .select("status", "quiz", "quizAnswers", "studentResponse")
        .first();
      if (!submission) {
        if (a.open) openUnsubmitted++;
        continue;
      }
      // Students respond to flags only after taking the quiz, and the quiz
      // only counts as a to-do once the teacher has activated it.
      if (submission.quiz != null && submission.quizAnswers == null) {
        if (a.quizOpen) needsAnswers++;
      } else if (submission.status === "flagged" && submission.studentResponse == null) needsResponse++;
    }

    classes.push({
      id: cls.id,
      name: cls.name,
      totalAssignments: assignments.length,
      openUnsubmitted,
      needsResponse,
      needsAnswers,
    });
  }

  return NextResponse.json({ student: session, classes });
}
