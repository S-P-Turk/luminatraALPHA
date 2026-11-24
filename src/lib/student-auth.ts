import { cookies } from "next/headers";
import { readSession } from "./session";

export const STUDENT_COOKIE = "student_session";

export type StudentSession = {
  name: string;
  email: string;
};

/**
 * The signed-in student, from a signed session cookie. Identity is
 * independent of any one class; class membership lives in Enrollment.
 */
export async function getCurrentStudentSession(): Promise<StudentSession | null> {
  const store = await cookies();
  const session = readSession<{ role?: string; name?: string; email?: string }>(store.get(STUDENT_COOKIE)?.value);
  if (session?.role === "student" && typeof session.name === "string" && typeof session.email === "string") {
    return { name: session.name, email: session.email };
  }
  return null;
}
