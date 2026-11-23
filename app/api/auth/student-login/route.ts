import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/src/prisma/db";
import { STUDENT_COOKIE } from "@/src/lib/student-auth";
import { isValidEmail } from "@/src/lib/auth";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected JSON body." }, { status: 400 });
  }

  const joinCode = typeof (body as { joinCode?: unknown })?.joinCode === "string"
    ? (body as { joinCode: string }).joinCode.trim().toUpperCase()
    : "";
  const name = typeof (body as { name?: unknown })?.name === "string"
    ? (body as { name: string }).name.trim()
    : "";
  const email = typeof (body as { email?: unknown })?.email === "string"
    ? (body as { email: string }).email.trim().toLowerCase()
    : "";

  if (!joinCode) {
    return NextResponse.json({ error: "Enter your class code." }, { status: 400 });
  }
  if (!name) {
    return NextResponse.json({ error: "Enter your name." }, { status: 400 });
  }
  if (!isValidEmail(email)) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }

  const cls = await db.orm.public.Class.where({ joinCode }).first();
  if (!cls) {
    return NextResponse.json({ error: "That class code wasn't found. Check it and try again." }, { status: 404 });
  }

  const session = { classId: cls.id, name, email };
  const store = await cookies();
  store.set(STUDENT_COOKIE, JSON.stringify(session), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });

  return NextResponse.json({ class: { id: cls.id, name: cls.name } });
}
