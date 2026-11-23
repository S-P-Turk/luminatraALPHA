import { db } from "@/src/prisma/db";
import { getCurrentTeacherEmail } from "@/src/lib/auth";

/**
 * Resolves the signed-in teacher's DB row from the auth cookie. Returns null
 * if there's no cookie, or if the cookie points at an email with no Teacher
 * row (e.g. the database was reset under an active cookie) — callers should
 * treat both cases as "not logged in."
 */
export async function getCurrentTeacher() {
  const email = await getCurrentTeacherEmail();
  if (!email) return null;
  return db.orm.public.Teacher.where({ email }).first();
}
