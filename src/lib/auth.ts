import { cookies } from "next/headers";
import { readSession } from "./session";

export const TEACHER_COOKIE = "teacher_email";

/**
 * The signed-in teacher's email, from a signed session cookie. Cookies from
 * before passwords existed (plain emails) fail verification, so those
 * teachers simply sign in again.
 */
export async function getCurrentTeacherEmail(): Promise<string | null> {
  const store = await cookies();
  const session = readSession<{ role?: string; email?: string }>(store.get(TEACHER_COOKIE)?.value);
  return session?.role === "teacher" && typeof session.email === "string" ? session.email : null;
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
