import { NextResponse } from "next/server";
import { isAdmin } from "@/src/lib/admin-auth";
import { CASES } from "@/src/lib/eval/cases";
import { REVIEW_THRESHOLD, WEIGHTS, SCORING_VERSION } from "@/src/lib/scoring";

// Lists the evaluation cases. The page then runs them one request per case,
// so no single request has to fit all 30 inside a server time limit.
export async function GET() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Admin only." }, { status: 401 });
  }
  return NextResponse.json({
    scoring: { version: SCORING_VERSION, weights: WEIGHTS, threshold: REVIEW_THRESHOLD },
    cases: CASES.map((c) => ({ id: c.id, course: c.course, scenario: c.scenario, expect: c.expect })),
  });
}
