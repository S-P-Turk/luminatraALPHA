// Client-safe parts of the quiz question check (no AI code): the case list,
// result types and the summary. The runner is in questions-check.ts.

import type { QuizQuestion } from "../quiz";
import { CASES, type EvalCase } from "./cases";

// One case per course for four scenarios that exercise the question writer:
// no AI, a pasted AI paragraph (questions must avoid it), a source the AI
// summarized, and an idea taken from the AI.
const SCENARIOS = ["01", "04", "08", "11"];
export const QUESTION_CASES: EvalCase[] = CASES.filter((c) => SCENARIOS.includes(c.id.split("-")[1]));

export type QuestionVerdict = QuizQuestion & {
  problems: string[];
  grounded: boolean; // the answer key is actually in the named paragraph
  onAiParagraph: boolean; // the named paragraph came from the AI chat
  authorAnswer: string;
  bluffAnswer: string;
  authorOk: boolean;
  bluffOk: boolean;
};

export type QuestionCheckResult = {
  id: string;
  course: string;
  scenario: string;
  questions: QuestionVerdict[];
  costUsd: number;
};

/** Headline numbers over every question in a set of results. */
export function summarizeQuestions(results: QuestionCheckResult[]) {
  const qs = results.flatMap((r) => r.questions);
  const n = qs.length;
  const count = (f: (q: QuestionVerdict) => boolean) => qs.filter(f).length;
  return {
    questions: n,
    rulesOk: count((q) => q.problems.length === 0),
    grounded: count((q) => q.grounded),
    onAi: count((q) => q.onAiParagraph),
    authorPass: count((q) => q.authorOk),
    bluffCaught: count((q) => !q.bluffOk),
    // Sharp = passes every check: rules, key in the paragraph, about the
    // student's own text, the author passes and the bluffer is caught.
    sharp: count((q) => !q.problems.length && q.grounded && !q.onAiParagraph && q.authorOk && !q.bluffOk),
  };
}
