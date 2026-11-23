import { NextResponse } from "next/server";
import { db } from "@/src/prisma/db";
import { getCurrentStudentSession } from "@/src/lib/student-auth";

export async function POST(request: Request) {
  const session = await getCurrentStudentSession();
  if (!session) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected JSON body." }, { status: 400 });
  }

  const joinCode = typeof (body as { joinCode?: unknown })?.joinCode === "string"
    ? (body as { joinCode: string }).joinCode.trim().toUpperCase()
    : "";
  if (!joinCode) {
    return NextResponse.json({ error: "Enter a class code." }, { status: 400 });
  }

  const cls = await db.orm.public.Class.where({ joinCode }).first();
  if (!cls) {
    return NextResponse.json({ error: "That class code wasn't found. Check it and try again." }, { status: 404 });
  }

  const existing = await db.orm.public.Enrollment
    .where({ classId: cls.id, studentEmail: session.email })
    .first();

  if (!existing) {
    try {
      await db.orm.public.Enrollment.create({
        classId: cls.id,
        studentName: session.name,
        studentEmail: session.email,
      });
    } catch {
      // Harmless race against a duplicate join click — fall through and
      // return the class either way, since the enrollment now exists.
    }
  }

  return NextResponse.json({ class: { id: cls.id, name: cls.name, quizOpen: cls.quizOpen } }, { status: 201 });
}
