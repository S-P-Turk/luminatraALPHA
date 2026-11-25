// Runs the AI analysis for a saved submission. Called in the background
// (after the submit response is sent), so the student never waits on it;
// their page polls until the status leaves "analyzing".

import { db } from "@/src/prisma/db";
import { generateQuiz } from "./quiz";
import { scoreSubmission } from "./scoring";
import { withAiContext } from "./ai";
import { nextStatus } from "./grading";

export const ANALYZING = "analyzing";
export const ANALYSIS_FAILED = "analysis_failed";

export async function analyzeSubmission(submissionId: number): Promise<void> {
  const row = await db.orm.public.Submission.where({ id: submissionId }).first();
  if (!row) return;
  const assignment = await db.orm.public.Assignment.where({ id: row.assignmentId }).first();
  const cls = assignment && (await db.orm.public.Class.where({ id: assignment.classId }).first());
  if (!assignment || !cls) return;

  // The class syllabus is the source of AI-use rules; the assignment's own
  // instructions tell the model what this particular piece of work asked
  // for, so the comprehension quiz can target the right claims.
  const policy = `COURSE SYLLABUS / AI-USE POLICY:\n${cls.syllabusText}\n\n---\n\nTHIS ASSIGNMENT'S INSTRUCTIONS:\n${assignment.title}\n${assignment.instructions}`;

  try {
    const quiz = await withAiContext({ classId: assignment.classId }, () =>
      generateQuiz(row.transcript, policy, row.assignmentText)
    );
    const scoreCard = scoreSubmission({ quiz, submissionText: row.assignmentText, transcript: row.transcript });
    await db.orm.public.Submission.where({ id: submissionId }).update({
      quiz,
      reportCard: { scoreCard },
      status: nextStatus("submitted", scoreCard, false),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "The analysis didn't finish.";
    await db.orm.public.Submission.where({ id: submissionId }).update({
      status: ANALYSIS_FAILED,
      reportCard: { error: message },
    });
  }
}
