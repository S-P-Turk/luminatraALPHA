import { NextResponse } from "next/server";
import { db } from "@/src/prisma/db";
import { getCurrentTeacher } from "@/src/lib/current-teacher";
import { gradeIfNeeded } from "@/src/lib/grading";

// Every submission across all of the signed-in teacher's classes, so the
// teacher has one place to review instead of opening each class.
export async function GET() {
  const teacher = await getCurrentTeacher();
  if (!teacher) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const classes = await db.orm.public.Class
    .where({ teacherId: teacher.id })
    .select("id", "name")
    .all();

  // Prototype scale: one query per class and per assignment title is fine.
  const assignmentTitles = new Map<number, string>();
  const submissions = [];
  for (const cls of classes) {
    const rows = await db.orm.public.Submission
      .where({ classId: cls.id })
      .select(
        "id",
        "classId",
        "assignmentId",
        "studentName",
        "studentEmail",
        "assignmentText",
        "transcript",
        "quiz",
        "quizAnswers",
        "reportCard",
        "studentResponse",
        "revisions",
        "status",
        "createdAt"
      )
      .all();
    for (const s of rows) {
      if (!assignmentTitles.has(s.assignmentId)) {
        const a = await db.orm.public.Assignment.where({ id: s.assignmentId }).select("title").first();
        assignmentTitles.set(s.assignmentId, a?.title ?? "Untitled assignment");
      }
      // Grades any answered-but-ungraded quiz (e.g. ones answered before
      // grading existed) so failed comprehension shows up as a flag.
      const graded = await gradeIfNeeded(s);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { transcript, ...rest } = s;
      submissions.push({
        ...rest,
        ...graded,
        className: cls.name,
        assignmentTitle: assignmentTitles.get(s.assignmentId),
      });
    }
  }

  submissions.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return NextResponse.json({ submissions });
}
