import { db } from "@/src/prisma/db";
import { CASES, type EvalCase } from "./cases";

// The built-in 36 cases plus any saved from the admin test lab.
export async function allCases(): Promise<EvalCase[]> {
  const saved = await db.orm.public.LabCase.orderBy((c) => c.createdAt.asc()).all();
  return [
    ...CASES,
    ...saved.map(
      (s): EvalCase => ({
        id: `lab-${s.id}`,
        course: "Saved from test lab",
        scenario: s.name,
        syllabus: s.syllabus,
        instructions: "",
        submission: s.submission,
        transcript: s.transcript,
        student: s.student === "vague" ? "vague" : "knows_work",
        expect: s.expect === "review" || s.expect === "no_review" ? s.expect : "either",
        why: "Saved from the test lab.",
        expectReliance: (s.expectReliance as EvalCase["expectReliance"]) ?? undefined,
      })
    ),
  ];
}
