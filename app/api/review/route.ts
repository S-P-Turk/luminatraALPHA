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

  // Load every class's submissions in parallel, look up titles once, and
  // grade all waiting quiz answers at once instead of one after another.
  const perClass = await Promise.all(
    classes.map((cls) =>
      db.orm.public.Submission
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
        .all()
        .then((rows) => rows.map((s) => ({ s, className: cls.name })))
    )
  );
  const rows = perClass.flat();
  const ids = [...new Set(rows.map((r) => r.s.assignmentId))];
  const titles = await Promise.all(
    ids.map((aid) => db.orm.public.Assignment.where({ id: aid }).select("id", "title").first())
  );
  const assignmentTitles = new Map(titles.filter(Boolean).map((a) => [a!.id, a!.title]));
  const graded = await Promise.all(rows.map((r) => gradeIfNeeded(r.s)));
  const submissions = rows.map(({ s, className }, i) => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { transcript, ...rest } = s;
    return {
      ...rest,
      ...graded[i],
      className,
      assignmentTitle: assignmentTitles.get(s.assignmentId) ?? "Untitled assignment",
    };
  });

  submissions.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return NextResponse.json({ submissions });
}
