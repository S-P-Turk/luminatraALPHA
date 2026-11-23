import { NextResponse } from "next/server";
import { db } from "@/src/prisma/db";
import { getCurrentTeacher } from "@/src/lib/current-teacher";

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
    .orderBy((s) => s.createdAt.desc())
    .all();

  return NextResponse.json({
    class: { id: cls.id, name: cls.name, joinCode: cls.joinCode },
    submissions,
  });
}
