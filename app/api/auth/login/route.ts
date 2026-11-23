import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/src/prisma/db";
import { TEACHER_COOKIE, isValidEmail } from "@/src/lib/auth";

// Prototype login: no password, no magic link. Submitting a valid-looking
// email creates the Teacher row if it doesn't exist yet, and sets a cookie
// that every other route trusts as "this request is this teacher."
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected JSON body." }, { status: 400 });
  }

  const email = typeof (body as { email?: unknown })?.email === "string"
    ? (body as { email: string }).email.trim().toLowerCase()
    : "";

  if (!isValidEmail(email)) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }

  const teacher = await db.orm.public.Teacher
    .where({ email })
    .upsert({
      create: { email },
      update: {},
    });

  const store = await cookies();
  store.set(TEACHER_COOKIE, teacher.email, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });

  return NextResponse.json({ email: teacher.email });
}
