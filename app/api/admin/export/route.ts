import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { db } from "@/src/prisma/db";
import { isAdmin } from "@/src/lib/admin-auth";

// Read-only export of recent submissions with their full analysis, for
// debugging the model. Allowed for a signed-in admin, or with the
// EXPORT_TOKEN query parameter when that env var is set (remove the env var
// to turn token access off). Never writes anything.
function tokenOk(given: string | null): boolean {
  const real = process.env.EXPORT_TOKEN;
  if (!real || !given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(real);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  if (!(await isAdmin()) && !tokenOk(url.searchParams.get("token"))) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  const limit = Math.min(50, Number(url.searchParams.get("limit") ?? 20) || 20);

  // Beta-sized table: load and slice in code.
  const rows = (await db.orm.public.Submission.orderBy((s) => s.createdAt.desc()).all()).slice(0, limit);

  const out = [];
  for (const s of rows) {
    const a = await db.orm.public.Assignment.where({ id: s.assignmentId }).select("title", "instructions", "quizOpen").first();
    const c = await db.orm.public.Class.where({ id: s.classId }).select("name", "syllabusText").first();
    out.push({
      id: s.id,
      createdAt: s.createdAt,
      student: s.studentName,
      status: s.status,
      class: c?.name,
      syllabus: c?.syllabusText?.slice(0, 4000),
      assignment: a?.title,
      instructions: a?.instructions,
      quizOpen: a?.quizOpen,
      submission: s.assignmentText,
      transcript: s.transcript,
      analysis: s.quiz,
      quizAnswers: s.quizAnswers,
      reportCard: s.reportCard,
      studentResponse: s.studentResponse,
    });
  }
  return NextResponse.json({ count: out.length, submissions: out });
}
