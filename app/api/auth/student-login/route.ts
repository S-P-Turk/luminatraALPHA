import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/src/prisma/db";
import { STUDENT_COOKIE } from "@/src/lib/student-auth";
import { isValidEmail } from "@/src/lib/auth";
import { hashPassword, passwordProblem, verifyPassword } from "@/src/lib/password";
import { signSession, SESSION_COOKIE_OPTIONS } from "@/src/lib/session";

// Student sign-in with email + password. Joining a class is a separate step
// (POST /api/student/join). New students give their name; students from
// before accounts existed keep the name they enrolled with.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  const givenName = typeof body?.name === "string" ? body.name.trim() : "";
  if (!isValidEmail(email)) return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });

  let student = await db.orm.public.Student.where({ email }).first();

  if (student?.passwordHash) {
    if (!(await verifyPassword(password, student.passwordHash))) {
      return NextResponse.json({ error: "That password isn't right." }, { status: 401 });
    }
  } else {
    const problem = passwordProblem(password);
    if (problem) return NextResponse.json({ error: problem }, { status: 400 });
    const passwordHash = await hashPassword(password);
    if (student) {
      await db.orm.public.Student.where({ id: student.id }).update({ passwordHash });
    } else {
      const prior = await db.orm.public.Enrollment
        .where({ studentEmail: email })
        .orderBy((e) => e.createdAt.desc())
        .select("studentName")
        .first();
      const name = prior?.studentName ?? givenName;
      if (!name) return NextResponse.json({ error: "Enter your name." }, { status: 400 });
      try {
        student = await db.orm.public.Student.create({ email, name, passwordHash });
      } catch {
        return NextResponse.json({ error: "Couldn't create the account. Try again." }, { status: 500 });
      }
    }
  }

  const session = { name: student!.name, email };
  const store = await cookies();
  store.set(STUDENT_COOKIE, signSession({ role: "student", ...session }), SESSION_COOKIE_OPTIONS);
  return NextResponse.json({ student: session });
}
