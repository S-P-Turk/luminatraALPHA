import { NextResponse } from "next/server";
import { isAdmin } from "@/src/lib/admin-auth";
import { allCases } from "@/src/lib/eval/all-cases";
import { runCaseTracked } from "@/src/lib/eval/run-case";

// One case is ~3 model calls; give it room.
export const maxDuration = 300;

export async function POST(_request: Request, ctx: RouteContext<"/api/admin/eval/[caseId]">) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Admin only." }, { status: 401 });
  }
  const { caseId } = await ctx.params;
  const c = (await allCases()).find((x) => x.id === caseId);
  if (!c) {
    return NextResponse.json({ error: "Unknown case." }, { status: 404 });
  }
  try {
    const result = await runCaseTracked(c);
    return NextResponse.json({ result });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Case failed." }, { status: 500 });
  }
}
