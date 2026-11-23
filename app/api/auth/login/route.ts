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

  // Find-or-create by hand rather than relying on .upsert(): chaining
  // .where({ email }).upsert(...) was issuing a plain insert regardless of
  // whether the row existed, which threw a unique-constraint violation on
  // every repeat login. This is a touch more verbose but unambiguous.
  let teacher = await db.orm.public.Teacher.where({ email }).first();
  if (!teacher) {
    try {
      teacher = await db.orm.public.Teacher.create({ email });
    } catch {
      // Lost a race with a concurrent request creating the same row.
      teacher = await db.orm.public.Teacher.where({ email }).first();
      if (!teacher) {
        return NextResponse.json({ error: "Could not sign in. Try again." }, { status: 500 });
      }
    }
  }

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
