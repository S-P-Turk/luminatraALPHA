import { NextResponse } from "next/server";
import { db } from "@/src/prisma/db";
import { getCurrentTeacher } from "@/src/lib/current-teacher";
import { ensureRulesCard, confirmRules, applyRulesMode, CARD_USES, type RulesCard, type UseStance, type CardUse } from "@/src/lib/rules";

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

  // Teacher picking "same as syllabus" or "no AI use allowed": { rulesMode }
  const modeRaw = (body as { rulesMode?: unknown })?.rulesMode;
  if (modeRaw === "syllabus" || modeRaw === "no_ai") {
    let current = (assignment.rulesCard ?? null) as RulesCard | null;
    // No syllabus reading saved yet: write one first.
    if (modeRaw === "syllabus" && !current?.fromSyllabus && current?.mode && current.mode !== "syllabus") current = null;
    if (!current) current = await ensureRulesCard({ ...assignment, rulesCard: null });
    const rulesCard = applyRulesMode(current, modeRaw);
    if (!rulesCard) return NextResponse.json({ error: "Couldn't read the syllabus rules. Try again." }, { status: 502 });
    const updated = await db.orm.public.Assignment.where({ id: assignmentId }).update({ rulesCard });
    return NextResponse.json({ assignment: { ...updated, rulesCard } });
  }

  // Teacher adjusting the AI rules ("custom"): { rules: { uses: {...}, disclose: "..." } }
  const rulesRaw = (body as { rules?: { uses?: Record<string, unknown>; disclose?: unknown } })?.rules;
  if (rulesRaw && typeof rulesRaw === "object") {
    const STANCES: UseStance[] = ["allowed", "with_disclosure", "not_allowed", "unclear", "n/a"];
    const uses: Partial<Record<CardUse, UseStance>> = {};
    for (const { key } of CARD_USES) {
      const v = rulesRaw.uses?.[key];
      if (v !== undefined) {
        if (typeof v !== "string" || !STANCES.includes(v as UseStance)) {
          return NextResponse.json({ error: `Invalid answer for ${key}.` }, { status: 400 });
        }
        uses[key] = v as UseStance;
      }
    }
    const disclose = typeof rulesRaw.disclose === "string" ? rulesRaw.disclose.slice(0, 300) : "";
    const rulesCard = confirmRules((assignment.rulesCard ?? null) as RulesCard | null, { uses, disclose });
    const updated = await db.orm.public.Assignment.where({ id: assignmentId }).update({ rulesCard });
    return NextResponse.json({ assignment: { ...updated, rulesCard } });
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
