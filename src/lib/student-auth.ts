import { cookies } from "next/headers";

export const STUDENT_COOKIE = "student_session";

export type StudentSession = {
  name: string;
  email: string;
};

/**
 * Prototype-only, same spirit as teacher auth: no password, the cookie is
 * the credential. Unlike the old version, this no longer carries a classId —
 * a student's identity (name/email) is independent of any one class, and
 * which classes they belong to lives in the Enrollment table instead, so a
 * student can join more than one class with the same session.
 */
export async function getCurrentStudentSession(): Promise<StudentSession | null> {
  const store = await cookies();
  const raw = store.get(STUDENT_COOKIE)?.value;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed?.name === "string" && typeof parsed?.email === "string") {
      return { name: parsed.name, email: parsed.email };
    }
    return null;
  } catch {
    return null;
  }
}
