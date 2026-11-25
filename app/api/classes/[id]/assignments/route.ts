import { NextResponse } from "next/server";
import { db } from "@/src/prisma/db";
import { getCurrentTeacher } from "@/src/lib/current-teacher";
import { ensureRulesCard } from "@/src/lib/rules";

export async function GET(_request: Request, ctx: RouteContext<"/api/classes/[id]/assignments">) {
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

  const assignments = await db.orm.public.Assignment
    .where({ classId: id })
    .orderBy((a) => a.createdAt.desc())
    .all();

  return NextResponse.json({ class: { id: cls.id, name: cls.name }, assignments });
}

export async function POST(request: Request, ctx: RouteContext<"/api/classes/[id]/assignments">) {
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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected JSON body." }, { status: 400 });
  }

  const title = typeof (body as { title?: unknown })?.title === "string"
    ? (body as { title: string }).title.trim()
    : "";
  const instructions = typeof (body as { instructions?: unknown })?.instructions === "string"
    ? (body as { instructions: string }).instructions.trim()
    : "";

  if (!title) {
    return NextResponse.json({ error: "Assignment title is required." }, { status: 400 });
  }
  if (!instructions) {
    return NextResponse.json({ error: "Describe what the assignment asks students to do." }, { status: 400 });
  }
  if (instructions.length > 10000) {
    return NextResponse.json({ error: "Instructions are too long (max 10,000 characters)." }, { status: 400 });
  }

  const created = await db.orm.public.Assignment.create({
    classId: id,
    title,
    instructions,
    open: false,
  });

  // Write the students' rules card now so the teacher sees any gaps in the
  // policy before the assignment opens. A failure here is retried later.
  const rulesCard = await ensureRulesCard(created);

  return NextResponse.json({ assignment: { ...created, rulesCard } }, { status: 201 });
}
