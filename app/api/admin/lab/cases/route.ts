import { NextResponse } from "next/server";
import { db } from "@/src/prisma/db";
import { requireAdmin } from "@/src/lib/admin-auth";

// Test cases saved from the lab. They join the test set automatically.
export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;
  const cases = await db.orm.public.LabCase.orderBy((c) => c.createdAt.desc()).all();
  return NextResponse.json({ cases });
}

export async function POST(request: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const b = await request.json().catch(() => null);
  const name = String(b?.name ?? "").trim();
  const syllabus = String(b?.syllabus ?? "").trim();
  const submission = String(b?.submission ?? "").trim();
  if (!name || !syllabus || !submission) {
    return NextResponse.json({ error: "A name, the syllabus and the submission are required." }, { status: 400 });
  }
  const expect = ["review", "no_review", "either"].includes(b?.expect) ? b.expect : "either";
  const levels = ["none", "ideas", "heavy", "written"];
  const created = await db.orm.public.LabCase.create({
    name: name.slice(0, 120),
    syllabus,
    transcript: String(b?.transcript ?? ""),
    submission,
    student: b?.student === "vague" ? "vague" : "knows_work",
    expect,
    expectReliance: levels.includes(b?.expectReliance) ? b.expectReliance : null,
  });
  return NextResponse.json({ case: created }, { status: 201 });
}
