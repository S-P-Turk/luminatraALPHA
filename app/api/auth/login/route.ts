import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/src/prisma/db";
import { TEACHER_COOKIE, isValidEmail } from "@/src/lib/auth";
import { hashPassword, passwordProblem, verifyPassword } from "@/src/lib/password";
import { signSession, SESSION_COOKIE_OPTIONS } from "@/src/lib/session";

// Teacher sign-in with email + password. A teacher with no password yet
// (new, or an account from before passwords) creates one here.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  if (!isValidEmail(email)) return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });

  let teacher = await db.orm.public.Teacher.where({ email }).first();

  if (teacher?.passwordHash) {
    if (!(await verifyPassword(password, teacher.passwordHash))) {
      return NextResponse.json({ error: "That password isn't right." }, { status: 401 });
    }
  } else {
    const problem = passwordProblem(password);
    if (problem) return NextResponse.json({ error: problem }, { status: 400 });
    const passwordHash = await hashPassword(password);
    if (teacher) {
      await db.orm.public.Teacher.where({ id: teacher.id }).update({ passwordHash });
    } else {
      try {
        teacher = await db.orm.public.Teacher.create({ email, passwordHash });
      } catch {
        return NextResponse.json({ error: "Couldn't create the account. Try again." }, { status: 500 });
      }
    }
  }

  const store = await cookies();
  store.set(TEACHER_COOKIE, signSession({ role: "teacher", email }), SESSION_COOKIE_OPTIONS);
  return NextResponse.json({ email });
}
