import { NextResponse } from "next/server";
import { db } from "@/src/prisma/db";
import { getCurrentTeacher } from "@/src/lib/current-teacher";
import { gradeIfNeeded } from "@/src/lib/grading";

export async function GET(_request: Request, ctx: RouteContext<"/api/classes/[id]/submissions">) {
  const teacher = await getCurrentTeacher();
  if (!teacher) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const { id: idParam } = await ctx.params;
  const id = Number(idParam);
  if (!Number.isInteger(id)) {
    return NextResponse.json({ error: "Invalid class id." }, { status: 400 });
  }

  // Only ever return data for a class this teacher actually owns.
  const cls = await db.orm.public.Class.where({ id, teacherId: teacher.id }).first();
  if (!cls) {
    return NextResponse.json({ error: "Class not found." }, { status: 404 });
  }

  const submissions = await db.orm.public.Submission
    .where({ classId: id })
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
      "createdAt",
      "updatedAt"
    )
    .orderBy((s) => s.createdAt.desc())
    .all();

  // One query for every assignment title, then grade all waiting quiz
  // answers at once instead of one after another.
  const ids = [...new Set(submissions.map((s) => s.assignmentId))];
  const titles = await Promise.all(
    ids.map((aid) => db.orm.public.Assignment.where({ id: aid }).select("id", "title").first())
  );
  const assignmentTitles = new Map(titles.filter(Boolean).map((a) => [a!.id, a!.title]));

  const graded = await Promise.all(submissions.map((s) => gradeIfNeeded(s)));
  const out = submissions.map((s, i) => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { transcript, ...rest } = s;
    return { ...rest, ...graded[i], assignmentTitle: assignmentTitles.get(s.assignmentId) ?? "Untitled assignment" };
  });

  return NextResponse.json({
    class: { id: cls.id, name: cls.name, joinCode: cls.joinCode },
    submissions: out,
  });
}
