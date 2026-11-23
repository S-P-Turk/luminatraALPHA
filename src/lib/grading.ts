import { db } from "@/src/prisma/db";
import { gradeAnswers, type QuizResult, type ComprehensionResult } from "@/src/lib/quiz";

// Stored in Submission.reportCard.
export type ReportCard = { comprehension: ComprehensionResult; gradedAt: string };

type GradableRow = {
  id: number;
  assignmentText: string;
  transcript: string;
  quiz: unknown;
  quizAnswers: unknown;
  reportCard: unknown;
  status: string;
};

/**
 * Grades a submission's quiz answers if they exist and haven't been graded
 * yet, saves the report card, and flags the submission for human follow-up
 * if the answers don't clearly show understanding. Returns the (possibly updated) reportCard and
 * status. Grading failures are swallowed so a review page still loads; the
 * submission just stays ungraded and is retried next time.
 */
export async function gradeIfNeeded(row: GradableRow): Promise<{ reportCard: unknown; status: string }> {
  if (row.reportCard != null || !row.quiz || !Array.isArray(row.quizAnswers)) {
    return { reportCard: row.reportCard, status: row.status };
  }

  let comprehension: ComprehensionResult;
  try {
    comprehension = await gradeAnswers({
      assignmentText: row.assignmentText,
      transcript: row.transcript,
      quiz: row.quiz as QuizResult,
      answers: row.quizAnswers as string[],
    });
  } catch {
    return { reportCard: row.reportCard, status: row.status };
  }

  const reportCard: ReportCard = { comprehension, gradedAt: new Date().toISOString() };
  // A comprehension follow-up is a separate reason from an AI-use concern, so
  // it flags the submission even if the teacher already cleared that concern.
  const status = comprehension.passed ? row.status : "flagged";

  await db.orm.public.Submission.where({ id: row.id }).update({ reportCard, status });
  return { reportCard, status };
}
