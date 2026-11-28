import { NextResponse } from "next/server";
import { isAdmin } from "@/src/lib/admin-auth";
import { checkQuestions, QUESTION_CASES } from "@/src/lib/eval/questions-check";

// Question writer (Sonnet, up to two calls) + two simulated students and two
// grades (Haiku) per case.
export const maxDuration = 120;

export async function POST(_request: Request, ctx: RouteContext<"/api/admin/eval/questions/[caseId]">) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Admin only." }, { status: 401 });
  const { caseId } = await ctx.params;
  const c = QUESTION_CASES.find((x) => x.id === caseId);
  if (!c) return NextResponse.json({ error: "Unknown case." }, { status: 404 });
  try {
    return NextResponse.json({ result: await checkQuestions(c) });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Check failed." }, { status: 500 });
  }
}
