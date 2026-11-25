import { NextResponse } from "next/server";
import { db } from "@/src/prisma/db";
import { getCurrentTeacher } from "@/src/lib/current-teacher";
import { ensureRulesCard } from "@/src/lib/rules";

export async function PATCH(
  request: Request,
  ctx: RouteContext<"/api/classes/[id]/assignments/[assignmentId]">
) {
  const teacher = await getCurrentTeacher();
  if (!teacher) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const { id: idParam, assignmentId: assignmentIdParam } = await ctx.params;
  const classId = Number(idParam);
  const assignmentId = Number(assignmentIdParam);
  if (!Number.isInteger(classId) || !Number.isInteger(assignmentId)) {
    return NextResponse.json({ error: "Invalid id." }, { status: 400 });
  }

  const cls = await db.orm.public.Class.where({ id: classId, teacherId: teacher.id }).first();
  if (!cls) {
    return NextResponse.json({ error: "Class not found." }, { status: 404 });
  }

  const assignment = await db.orm.public.Assignment.where({ id: assignmentId, classId }).first();
  if (!assignment) {
    return NextResponse.json({ error: "Assignment not found." }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected JSON body." }, { status: 400 });
  }

  const openRaw = (body as { open?: unknown })?.open;
  const quizOpenRaw = (body as { quizOpen?: unknown })?.quizOpen;
  if (typeof openRaw !== "boolean" && typeof quizOpenRaw !== "boolean") {
    return NextResponse.json({ error: "Send open and/or quizOpen as a boolean." }, { status: 400 });
  }

  const patch: { open?: boolean; quizOpen?: boolean } = {};
  if (typeof openRaw === "boolean") patch.open = openRaw;
  if (typeof quizOpenRaw === "boolean") patch.quizOpen = quizOpenRaw;

  const updated = await db.orm.public.Assignment.where({ id: assignmentId }).update(patch);
  // Opening an older assignment that never got a rules card writes one, so
  // students always see the rules before they start.
  const rulesCard = patch.open ? await ensureRulesCard(assignment) : assignment.rulesCard;

  return NextResponse.json({ assignment: { ...updated, rulesCard } });
}
