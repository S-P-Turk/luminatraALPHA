import { NextResponse } from "next/server";
import { db } from "@/src/prisma/db";
import { getCurrentStudentSession } from "@/src/lib/student-auth";

export async function GET() {
  const session = await getCurrentStudentSession();
  if (!session) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const cls = await db.orm.public.Class
    .where({ id: session.classId })
    .select("id", "name", "quizOpen")
    .first();

  if (!cls) {
    return NextResponse.json({ error: "Class not found." }, { status: 404 });
  }

  return NextResponse.json({ student: session, class: cls });
}
