import { NextResponse } from "next/server";
import { db } from "@/src/prisma/db";
import { getCurrentTeacher } from "@/src/lib/current-teacher";
import { generateJoinCode } from "@/src/lib/join-code";

export async function GET() {
  const teacher = await getCurrentTeacher();
  if (!teacher) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const classes = await db.orm.public.Class
    .where({ teacherId: teacher.id })
    .orderBy((c) => c.createdAt.desc())
    .all();

  return NextResponse.json({ classes });
}

export async function POST(request: Request) {
  const teacher = await getCurrentTeacher();
  if (!teacher) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected JSON body." }, { status: 400 });
  }

  const name = typeof (body as { name?: unknown })?.name === "string"
    ? (body as { name: string }).name.trim()
    : "";
  const syllabusText = typeof (body as { syllabusText?: unknown })?.syllabusText === "string"
    ? (body as { syllabusText: string }).syllabusText.trim()
    : "";

  if (!name) {
    return NextResponse.json({ error: "Class name is required." }, { status: 400 });
  }
  if (!syllabusText) {
    return NextResponse.json({ error: "Paste the syllabus / AI-use policy text." }, { status: 400 });
  }
  if (syllabusText.length > 20000) {
    return NextResponse.json({ error: "Syllabus text is too long (max 20,000 characters)." }, { status: 400 });
  }

  // Retry on the rare chance of a collision with an existing code.
  let created;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      created = await db.orm.public.Class.create({
        name,
        syllabusText,
        teacherId: teacher.id,
        joinCode: generateJoinCode(),
      });
      break;
    } catch {
      if (attempt === 4) {
        return NextResponse.json({ error: "Could not generate a class code. Try again." }, { status: 500 });
      }
    }
  }

  return NextResponse.json({ class: created }, { status: 201 });
}
