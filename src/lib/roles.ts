import { db } from "@/src/prisma/db";

// One email = one role. These checks stop a student's email from quietly
// becoming a teacher account (or the reverse) when someone uses the wrong
// sign-in page.

/** The email is a student: has a student account or has joined a class. */
export async function isStudentEmail(email: string): Promise<boolean> {
  const s = await db.orm.public.Student.where({ email }).select("id").first();
  if (s) return true;
  const e = await db.orm.public.Enrollment.where({ studentEmail: email }).select("id").first();
  return Boolean(e);
}

/** The email is a real teacher: has set a password or owns a class. */
export async function isTeacherEmail(email: string): Promise<boolean> {
  const t = await db.orm.public.Teacher.where({ email }).select("id", "passwordHash").first();
  if (!t) return false;
  if (t.passwordHash) return true;
  const c = await db.orm.public.Class.where({ teacherId: t.id }).select("id").first();
  return Boolean(c);
}

/**
 * A teacher row with no classes, for an email that's a student, is an
 * accident from using the teacher sign-in by mistake — treat the email as a
 * student. A teacher who owns classes is always a teacher.
 */
export async function teacherOwnsClasses(email: string): Promise<boolean> {
  const t = await db.orm.public.Teacher.where({ email }).select("id").first();
  if (!t) return false;
  const c = await db.orm.public.Class.where({ teacherId: t.id }).select("id").first();
  return Boolean(c);
}

export const WRONG_ROLE = {
  teacher: "This email belongs to a student account. Use student sign-in instead.",
  student: "This email belongs to a teacher account. Use teacher sign-in instead.",
};
