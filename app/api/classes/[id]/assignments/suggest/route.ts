import { NextResponse } from "next/server";
import { db } from "@/src/prisma/db";
import { getCurrentTeacher } from "@/src/lib/current-teacher";
import { generateAssignmentSuggestions } from "@/src/lib/assignment-suggestions";

// Reads this class's syllabus and proposes assignments (title + what it
// asks students to do). Nothing is persisted here — the teacher reviews and
// edits each suggestion, then creates it the normal way via POST
// /api/classes/[id]/assignments.
export async function POST(_request: Request, ctx: RouteContext<"/api/classes/[id]/assignments/suggest">) {
  const teacher = await getCurrentTeacher();
  if (!teacher) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const { id: idParam } = await ctx.params;
  const id = Number(idParam);
  if (!Number.isInteger(id)) {
    return NextResponse.json({ error: "Invalid class id." }, { status: 400 });
  }

  const cls = await db.orm.public.Class.where({ id, teacherId: teacher.id }).first();
  if (!cls) {
    return NextResponse.json({ error: "Class not found." }, { status: 404 });
  }

  try {
    const suggestions = await generateAssignmentSuggestions(cls.syllabusText);
    return NextResponse.json({ suggestions });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Could not generate suggestions.";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
