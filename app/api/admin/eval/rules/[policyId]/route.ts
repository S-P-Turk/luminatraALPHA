import { NextResponse } from "next/server";
import { isAdmin } from "@/src/lib/admin-auth";
import { REAL_POLICY_CASES } from "@/src/lib/eval/policies-real";
import { POLICY_CASES } from "@/src/lib/eval/policies";
import { checkPolicy } from "@/src/lib/eval/rules-check";

// Two model calls per policy.
export const maxDuration = 120;

export async function POST(_request: Request, ctx: RouteContext<"/api/admin/eval/rules/[policyId]">) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Admin only." }, { status: 401 });
  }
  const { policyId } = await ctx.params;
  const p = [...REAL_POLICY_CASES, ...POLICY_CASES].find((x) => x.id === policyId);
  if (!p) return NextResponse.json({ error: "Unknown policy." }, { status: 404 });
  try {
    return NextResponse.json({ result: await checkPolicy(p) });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Check failed." }, { status: 500 });
  }
}
