import { db } from "@/src/prisma/db";
import { gradeAnswers, type QuizResult, type ComprehensionResult } from "@/src/lib/quiz";
import { withAiContext } from "@/src/lib/ai";
import { scoreSubmission, SCORING_VERSION, type ScoreCard } from "@/src/lib/scoring";

// Stored in Submission.reportCard.
export type ReportCard = {
  comprehension?: ComprehensionResult;
  scoreCard?: ScoreCard;
  gradedAt?: string;
};

// Statuses a teacher sets by hand. These are the labels we learn from.
export const TEACHER_DECISIONS = ["cleared", "follow_up"] as const;

type Row = {
  id: number;
  classId?: number;
  assignmentText: string;
  transcript: string;
  quiz: unknown;
  quizAnswers: unknown;
  reportCard: unknown;
  status: string;
};

/** Status after scoring, without overriding a teacher's decision unless there's new evidence. */
export function nextStatus(current: string, card: ScoreCard, newComprehensionConcern: boolean): string {
  if (!card.needsReview) return current;
  if (current === "submitted") return "flagged";
  // A new comprehension concern is new evidence, so it re-opens a cleared
  // submission for review.
  if (current === "cleared" && newComprehensionConcern) return "flagged";
  return current;
}

/**
 * Brings a submission's analysis up to date: grades quiz answers if they
 * exist and haven't been graded, then (re)computes the follow-up score if
 * it's missing, outdated, or the grading just changed. Saves and returns the
 * new reportCard and status. AI failures are swallowed so a page still
 * loads; the work is retried next time.
 */
export async function gradeIfNeeded(row: Row): Promise<{ reportCard: unknown; status: string }> {
  if (!row.quiz) return { reportCard: row.reportCard, status: row.status };

  const prev = (row.reportCard ?? {}) as ReportCard;
  let comprehension = prev.comprehension;
  let newlyGraded = false;

  if (!comprehension && Array.isArray(row.quizAnswers)) {
    try {
      comprehension = await withAiContext({ classId: row.classId ?? null }, () =>
        gradeAnswers({
          assignmentText: row.assignmentText,
          transcript: row.transcript,
          quiz: row.quiz as QuizResult,
          answers: row.quizAnswers as string[],
        })
      );
      newlyGraded = true;
    } catch {
      // leave ungraded; retried next load
    }
  }

  const scoreStale = !prev.scoreCard || prev.scoreCard.version !== SCORING_VERSION;
  if (!newlyGraded && !scoreStale) return { reportCard: row.reportCard, status: row.status };

  const scoreCard = scoreSubmission({
    quiz: row.quiz as QuizResult,
    submissionText: row.assignmentText,
    transcript: row.transcript,
    comprehension,
  });
  const reportCard: ReportCard = {
    ...prev,
    comprehension,
    scoreCard,
    gradedAt: newlyGraded ? new Date().toISOString() : prev.gradedAt,
  };
  const status = nextStatus(row.status, scoreCard, newlyGraded && scoreCard.signals.comprehension.value > 0);

  await db.orm.public.Submission.where({ id: row.id }).update({ reportCard, status });
  return { reportCard, status };
}

/**
 * What a student is allowed to see of their own submission: the follow-up
 * notes, but never the score or the raw evidence behind it.
 */
export function forStudent<T extends { reportCard?: unknown; quiz?: unknown }>(submission: T): T {
  const rc = (submission.reportCard ?? null) as ReportCard | null;
  const quiz = (submission.quiz ?? null) as (QuizResult & Record<string, unknown>) | null;
  let safeQuiz: unknown = quiz;
  if (quiz) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { ai_passages, policy_severity, ...rest } = quiz;
    safeQuiz = rest;
  }
  return {
    ...submission,
    quiz: safeQuiz,
    reportCard: rc?.comprehension ? { comprehension: { passed: rc.comprehension.passed, note: rc.comprehension.note } } : null,
  };
}
