import { db } from "@/src/prisma/db";
import { requireAdmin } from "@/src/lib/admin-auth";
import type { ScoreCard } from "@/src/lib/scoring";

// All submissions with their scores, as CSV (for pilot reports).
const q = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;
  const [subs, classes, assignments] = await Promise.all([
    db.orm.public.Submission.select("id", "classId", "assignmentId", "studentName", "studentEmail", "status", "reportCard", "createdAt").all(),
    db.orm.public.Class.select("id", "name").all(),
    db.orm.public.Assignment.select("id", "title").all(),
  ]);
  const lines = ["submitted_at,class,assignment,student,email,status,priority,comprehension,ai_reliance,syllabus,needs_review"];
  for (const s of subs) {
    const card = (s.reportCard as { scoreCard?: ScoreCard } | null)?.scoreCard;
    lines.push(
      [
        new Date(s.createdAt).toISOString(),
        q(classes.find((c) => c.id === s.classId)?.name),
        q(assignments.find((a) => a.id === s.assignmentId)?.title),
        q(s.studentName),
        q(s.studentEmail),
        s.status,
        card?.score ?? "",
        card?.signals.comprehension?.points ?? "",
        card?.signals.reliance?.points ?? "",
        card?.signals.policy?.points ?? "",
        card?.needsReview ?? "",
      ].join(",")
    );
  }
  return new Response(lines.join("\n"), {
    headers: { "Content-Type": "text/csv", "Content-Disposition": `attachment; filename="luminatra-submissions.csv"` },
  });
}
