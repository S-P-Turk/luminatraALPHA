import { cookies } from "next/headers";

export const TEACHER_COOKIE = "teacher_email";

/**
 * Prototype-only auth: no passwords, no magic links. Whoever controls the
 * cookie is "logged in" as that email. Good enough for Hour 1-6 of the
 * prototype; replace with real auth (magic link / SSO) before this touches
 * real students or teachers.
 */
export async function getCurrentTeacherEmail(): Promise<string | null> {
  const store = await cookies();
  return store.get(TEACHER_COOKIE)?.value ?? null;
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
