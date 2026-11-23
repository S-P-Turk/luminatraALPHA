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

  const quizOpen = (body as { quizOpen?: unknown })?.quizOpen;
  if (typeof quizOpen !== "boolean") {
    return NextResponse.json({ error: "quizOpen must be a boolean." }, { status: 400 });
  }

  // Only update a class that actually belongs to this teacher — otherwise
  // teacher A could toggle teacher B's class by guessing an id.
  const existing = await db.orm.public.Class.where({ id, teacherId: teacher.id }).first();
  if (!existing) {
    return NextResponse.json({ error: "Class not found." }, { status: 404 });
  }

  const updated = await db.orm.public.Class
    .where({ id })
    .select("id", "name", "syllabusText", "quizOpen", "createdAt")
    .update({ quizOpen });

  return NextResponse.json({ class: updated });
}
