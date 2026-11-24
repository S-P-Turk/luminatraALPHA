import { NextResponse } from "next/server";
import { db } from "@/src/prisma/db";
import { requireAdmin } from "@/src/lib/admin-auth";
import { SCORING_VERSION } from "@/src/lib/scoring";

// Saves a finished test-set run for the model-quality history.
export async function POST(request: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const b = await request.json().catch(() => null);
  const n = (k: string) => (Number.isFinite(Number(b?.[k])) ? Number(b[k]) : 0);
  const run = await db.orm.public.EvalRun.create({
    version: SCORING_VERSION,
    total: n("total"),
    judged: n("judged"),
    correct: n("correct"),
    relianceJudged: n("relianceJudged"),
    relianceCorrect: n("relianceCorrect"),
    borderline: n("borderline"),
    errors: n("errors"),
    costUsd: n("costUsd"),
    detail: Array.isArray(b?.misses) ? { misses: b.misses.slice(0, 100) } : null,
  });
  return NextResponse.json({ run }, { status: 201 });
}
