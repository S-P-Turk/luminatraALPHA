import { NextResponse } from "next/server";
import { db } from "@/src/prisma/db";
import { isValidEmail } from "@/src/lib/auth";

// Step 1 of sign-in: tells the form what to ask for next.
//   "sign_in"      — account has a password; ask for it.
//   "set_password" — known account with no password yet (existed before
//                    passwords, or a teacher reset it); ask them to create one.
//   "new"          — no account; create one (students also give their name).
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const role = body?.role === "student" ? "student" : body?.role === "teacher" ? "teacher" : null;
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!role) return NextResponse.json({ error: "Unknown role." }, { status: 400 });
  if (!isValidEmail(email)) return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });

  if (role === "teacher") {
    const t = await db.orm.public.Teacher.where({ email }).select("passwordHash").first();
    return NextResponse.json({ next: !t ? "new" : t.passwordHash ? "sign_in" : "set_password" });
  }

  const s = await db.orm.public.Student.where({ email }).select("passwordHash").first();
  if (s) return NextResponse.json({ next: s.passwordHash ? "sign_in" : "set_password" });
  // Students from before accounts existed only appear in Enrollment.
  const prior = await db.orm.public.Enrollment.where({ studentEmail: email }).select("id").first();
  return NextResponse.json({ next: prior ? "set_password" : "new" });
}
