// Runs the AI analysis for a saved submission. Called in the background
// (after the submit response is sent), so the student never waits on it;
// their page polls until the status leaves "analyzing".

import { db } from "@/src/prisma/db";
import { analyzeSubmission as runAnalysis, writeQuizQuestions, type QuizResult } from "./quiz";
import { splitParagraphs } from "./paragraphs";
import { scoreSubmission } from "./scoring";
import { withAiContext } from "./ai";
import { nextStatus } from "./grading";
import { redact, restore } from "./redact";
import { confirmedRulesText, type RulesCard } from "./rules";

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
  const policy = `COURSE SYLLABUS / AI-USE POLICY:\n${cls.syllabusText}\n\n---\n\nTHIS ASSIGNMENT'S INSTRUCTIONS:\n${assignment.title}\n${assignment.instructions}${confirmedRulesText(assignment.rulesCard as RulesCard | null)}`;

  try {
    // The student's name and email never leave our servers.
    const who = { name: row.studentName, email: row.studentEmail };
    const transcript = redact(row.transcript, who);
    const work = redact(row.assignmentText, who);

    // 1. Score first, so the student sees it as soon as possible.
    const analysis = noAiUsed(row.transcript)
      ? noAiAnalysis(row.assignmentText)
      : restore(await withAiContext({ classId: assignment.classId }, () => runAnalysis(transcript, policy, work)), who);
    const scoreCard = scoreSubmission({ quiz: analysis, submissionText: row.assignmentText, transcript: row.transcript });
    await db.orm.public.Submission.where({ id: submissionId }).update({
      quiz: analysis,
      reportCard: { scoreCard },
      status: nextStatus("submitted", scoreCard, false),
    });

    // 2. Then the comprehension quiz, which isn't needed until the teacher
    // activates it. A failure here leaves the score in place; the questions
    // are written on demand when the quiz opens (ensureQuizQuestions).
    try {
      const questions = restore(
        await withAiContext({ classId: assignment.classId }, () => writeQuizQuestions(transcript, policy, work)),
        who
      );
      await db.orm.public.Submission.where({ id: submissionId }).update({ quiz: { ...analysis, ...questions } });
    } catch {
      // retried later
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "The analysis didn't finish.";
    await db.orm.public.Submission.where({ id: submissionId }).update({
      status: ANALYSIS_FAILED,
      reportCard: { error: message },
    });
  }
}

/**
 * A transcript that only says the student didn't use AI has nothing to
 * compare against, so the score needs no model call. Kept deliberately
 * narrow: a short statement with no chat in it.
 */
export function noAiUsed(transcript: string): boolean {
  const t = transcript.trim();
  if (!t || t.length > 300) return false;
  if (/^\s*(user|assistant|you|chatgpt|claude|ai|gemini|copilot)\s*:/im.test(t)) return false;
  if (/\b(used|using|asked|helped|brainstorm)\b/i.test(t) && !/\b(not|n't|never|no)\b/i.test(t)) return false;
  return /(\bno\b|\bnot\b|n't\b|\bnever\b|\bwithout\b|\bnone\b).{0,40}\b(ai|a\.i\.|chatgpt|claude|gemini|copilot|chatbot|artificial intelligence)\b|^\s*(none|n\/a|no ai( used)?)\.?\s*$/i.test(t);
}

function noAiAnalysis(submissionText: string): QuizResult {
  return {
    policy_summary: "",
    policy_concern: "",
    policy_severity: "none",
    ai_passages: [],
    usage_summary: "No AI use shown in the transcript.",
    paragraphs: splitParagraphs(submissionText).map((p) => ({
      index: p.index,
      reliance: "none" as const,
      disclosed: false,
      note: "",
      ai_source_excerpt: "",
    })),
    claimed_unassisted_areas: ["the whole submission"],
    quiz: [],
  };
}

/**
 * Writes the quiz questions if they're missing (the background step failed
 * or hasn't finished). Called when the quiz opens for a student.
 */
export async function ensureQuizQuestions(submissionId: number): Promise<void> {
  const row = await db.orm.public.Submission.where({ id: submissionId }).first();
  if (!row) return;
  const quiz = (row.quiz ?? null) as QuizResult | null;
  if (!quiz || (Array.isArray(quiz.quiz) && quiz.quiz.length > 0)) return;
  const assignment = await db.orm.public.Assignment.where({ id: row.assignmentId }).first();
  const cls = assignment && (await db.orm.public.Class.where({ id: assignment.classId }).first());
  if (!assignment || !cls) return;
  const policy = `COURSE SYLLABUS / AI-USE POLICY:\n${cls.syllabusText}\n\n---\n\nTHIS ASSIGNMENT'S INSTRUCTIONS:\n${assignment.title}\n${assignment.instructions}${confirmedRulesText(assignment.rulesCard as RulesCard | null)}`;
  const who = { name: row.studentName, email: row.studentEmail };
  const questions = restore(
    await withAiContext({ classId: assignment.classId }, () =>
      writeQuizQuestions(redact(row.transcript, who), policy, redact(row.assignmentText, who))
    ),
    who
  );
  await db.orm.public.Submission.where({ id: submissionId }).update({ quiz: { ...quiz, ...questions } });
}
