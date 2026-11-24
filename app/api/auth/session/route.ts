import { NextResponse } from "next/server";
import { getCurrentTeacherEmail } from "@/src/lib/auth";
import { getCurrentStudentSession } from "@/src/lib/student-auth";
import { isAdmin } from "@/src/lib/admin-auth";

// Lightweight "who am I" for the shared header.
export async function GET() {
  const [teacher, student, admin] = await Promise.all([
    getCurrentTeacherEmail(),
    getCurrentStudentSession(),
    isAdmin(),
  ]);
  return NextResponse.json({ teacher, student, admin });
}
