import { cookies } from "next/headers";
import { createHash, timingSafeEqual } from "node:crypto";

// Admin access is separate from teacher login (which is email-only in this
// prototype): the admin page spends API credits, so it requires the
// ADMIN_PASSWORD set in the deployment's environment.

export const ADMIN_COOKIE = "lum_admin";

function tokenFor(password: string): string {
  return createHash("sha256").update(`luminatra-admin:${password}`).digest("hex");
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

export function adminConfigured(): boolean {
  return Boolean(process.env.ADMIN_PASSWORD);
}

export function checkAdminPassword(candidate: string): string | null {
  const real = process.env.ADMIN_PASSWORD;
  if (!real || !safeEqual(tokenFor(candidate), tokenFor(real))) return null;
  return tokenFor(real);
}

export async function isAdmin(): Promise<boolean> {
  const real = process.env.ADMIN_PASSWORD;
  if (!real) return false;
  const store = await cookies();
  const got = store.get(ADMIN_COOKIE)?.value;
  return Boolean(got) && safeEqual(got!, tokenFor(real));
}
