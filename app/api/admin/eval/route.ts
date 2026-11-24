import { NextResponse } from "next/server";
import { isAdmin } from "@/src/lib/admin-auth";
import { allCases } from "@/src/lib/eval/all-cases";
import { REVIEW_THRESHOLD, WEIGHTS, SCORING_VERSION } from "@/src/lib/scoring";

// Lists the evaluation cases. The page then runs them one request per case,
// so no single request has to fit all 30 inside a server time limit.
export async function GET(request: Request) {
  // ?full=1 also returns the texts, for loading a case into the test lab.
  const full = new URL(request.url).searchParams.get("full") === "1";
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Admin only." }, { status: 401 });
  }
  return NextResponse.json({
    scoring: { version: SCORING_VERSION, weights: WEIGHTS, threshold: REVIEW_THRESHOLD },
    cases: (await allCases()).map((c) => ({
      id: c.id,
      course: c.course,
      scenario: c.scenario,
      expect: c.expect,
      expectReliance: c.expectReliance ?? null,
      ...(full ? { syllabus: c.syllabus, instructions: c.instructions, transcript: c.transcript, submission: c.submission, student: c.student } : {}),
    })),
  });
}
