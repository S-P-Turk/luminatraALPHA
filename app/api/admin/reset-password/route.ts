import { NextResponse } from "next/server";
import { db } from "@/src/prisma/db";
import { isAdmin } from "@/src/lib/admin-auth";
import { isValidEmail } from "@/src/lib/auth";

// Admin-only: clears any teacher's or student's password so they create a
// new one at their next sign-in. Also removes an accidental empty teacher
// account for a student's email when asked.
export async function POST(request: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Admin only." }, { status: 401 });

  const body = await request.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!isValidEmail(email)) return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });

  const done: string[] = [];

  const student = await db.orm.public.Student.where({ email }).select("id").first();
  if (student) {
    await db.orm.public.Student.where({ id: student.id }).update({ passwordHash: null });
    done.push("student password cleared");
  } else if (await db.orm.public.Enrollment.where({ studentEmail: email }).select("id").first()) {
    done.push("student has no password yet");
  }

  const teacher = await db.orm.public.Teacher.where({ email }).select("id").first();
  if (teacher) {
    const ownsClass = await db.orm.public.Class.where({ teacherId: teacher.id }).select("id").first();
    if (!ownsClass && done.length > 0) {
      // An empty teacher row for a student's email was created by mistake.
      await db.orm.public.Teacher.where({ id: teacher.id }).delete();
      done.push("removed an accidental empty teacher account");
    } else {
      await db.orm.public.Teacher.where({ id: teacher.id }).update({ passwordHash: null });
      done.push("teacher password cleared");
    }
  }

  if (done.length === 0) return NextResponse.json({ error: "No account with that email." }, { status: 404 });
  return NextResponse.json({ ok: true, done });
}
