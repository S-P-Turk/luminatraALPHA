import { NextResponse } from "next/server";
import { db } from "@/src/prisma/db";
import { getCurrentTeacher } from "@/src/lib/current-teacher";

export async function PATCH(request: Request, ctx: RouteContext<"/api/classes/[id]">) {
  const teacher = await getCurrentTeacher();
  if (!teacher) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const { id: idParam } = await ctx.params;
  const id = Number(idParam);
  if (!Number.isInteger(id)) {
    return NextResponse.json({ error: "Invalid class id." }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected JSON body." }, { status: 400 });
  }

  const quizOpenRaw = (body as { quizOpen?: unknown })?.quizOpen;
  const joinCodeRaw = (body as { joinCode?: unknown })?.joinCode;

  if (quizOpenRaw === undefined && joinCodeRaw === undefined) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }
  if (quizOpenRaw !== undefined && typeof quizOpenRaw !== "boolean") {
    return NextResponse.json({ error: "quizOpen must be a boolean." }, { status: 400 });
  }

  let joinCode: string | undefined;
  if (joinCodeRaw !== undefined) {
    if (typeof joinCodeRaw !== "string") {
      return NextResponse.json({ error: "joinCode must be a string." }, { status: 400 });
    }
    joinCode = joinCodeRaw.trim().toUpperCase();
    if (!/^[A-Z0-9]{3,12}$/.test(joinCode)) {
      return NextResponse.json(
        { error: "Class code must be 3-12 letters/numbers." },
        { status: 400 }
      );
    }
  }

  // Only update a class that actually belongs to this teacher — otherwise
  // teacher A could toggle teacher B's class by guessing an id.
  const existing = await db.orm.public.Class.where({ id, teacherId: teacher.id }).first();
  if (!existing) {
    return NextResponse.json({ error: "Class not found." }, { status: 404 });
  }

  if (joinCode) {
    const codeTaken = await db.orm.public.Class.where({ joinCode }).first();
    if (codeTaken && codeTaken.id !== id) {
      return NextResponse.json({ error: "That code is already in use by another class." }, { status: 409 });
    }
  }

  const patch: { quizOpen?: boolean; joinCode?: string } = {};
  if (typeof quizOpenRaw === "boolean") patch.quizOpen = quizOpenRaw;
  if (joinCode) patch.joinCode = joinCode;

  const updated = await db.orm.public.Class
    .where({ id })
    .select("id", "name", "syllabusText", "quizOpen", "joinCode", "createdAt")
    .update(patch);

  return NextResponse.json({ class: updated });
}

// Deletes a class and everything in it: assignments, enrollments and student
// submissions. Spending records (ApiCall) stay for cost history. Order
// matters: children first, so a failure part-way never leaves rows pointing
// at a class that's gone; the teacher can simply delete again.
export async function DELETE(_request: Request, ctx: RouteContext<"/api/classes/[id]">) {
  const teacher = await getCurrentTeacher();
  if (!teacher) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const id = Number((await ctx.params).id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: "Invalid class id." }, { status: 400 });

  const existing = await db.orm.public.Class.where({ id, teacherId: teacher.id }).select("id").first();
  if (!existing) return NextResponse.json({ error: "Class not found." }, { status: 404 });

  await db.orm.public.Submission.where({ classId: id }).deleteAndCount();
  await db.orm.public.Enrollment.where({ classId: id }).deleteAndCount();
  await db.orm.public.Assignment.where({ classId: id }).deleteAndCount();
  await db.orm.public.Class.where({ id }).delete();
  return NextResponse.json({ ok: true });
}
