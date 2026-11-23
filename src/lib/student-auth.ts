import { cookies } from "next/headers";

export const STUDENT_COOKIE = "student_session";

export type StudentSession = {
  classId: number;
  name: string;
  email: string;
};

/**
 * Prototype-only, same spirit as teacher auth: no password, the cookie is
 * the credential. Holds which class the student joined via its code, plus
 * the name/email they gave — not a persistent Student row.
 */
export async function getCurrentStudentSession(): Promise<StudentSession | null> {
  const store = await cookies();
  const raw = store.get(STUDENT_COOKIE)?.value;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (
      typeof parsed?.classId === "number" &&
      typeof parsed?.name === "string" &&
      typeof parsed?.email === "string"
    ) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}
