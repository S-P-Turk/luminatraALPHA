import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { STUDENT_COOKIE } from "@/src/lib/student-auth";
import { isValidEmail } from "@/src/lib/auth";

// Despite the path (kept for compatibility with the existing login page),
// this no longer joins a class — it just identifies the student. Joining a
// class is a separate step (POST /api/student/join) so the same identity
// can join any number of classes.
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected JSON body." }, { status: 400 });
  }

  const name = typeof (body as { name?: unknown })?.name === "string"
    ? (body as { name: string }).name.trim()
    : "";
  const email = typeof (body as { email?: unknown })?.email === "string"
    ? (body as { email: string }).email.trim().toLowerCase()
    : "";

  if (!name) {
    return NextResponse.json({ error: "Enter your name." }, { status: 400 });
  }
  if (!isValidEmail(email)) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }

  const session = { name, email };
  const store = await cookies();
  store.set(STUDENT_COOKIE, JSON.stringify(session), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });

  return NextResponse.json({ student: session });
}
