import { db } from "@/src/prisma/db";
import { requireAdmin } from "@/src/lib/admin-auth";

// Every logged Claude call, as CSV.
export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;
  const calls = await db.orm.public.ApiCall.orderBy((c) => c.createdAt.desc()).all();
  const lines = ["created_at,step,model,input_tokens,output_tokens,cost_usd,duration_ms,ok,class_id"];
  for (const c of calls) {
    lines.push(
      [new Date(c.createdAt).toISOString(), c.step, c.model, c.inputTokens, c.outputTokens, c.costUsd.toFixed(6), c.durationMs, c.ok, c.classId ?? ""].join(",")
    );
  }
  return new Response(lines.join("\n"), {
    headers: { "Content-Type": "text/csv", "Content-Disposition": `attachment; filename="luminatra-api-calls.csv"` },
  });
}
