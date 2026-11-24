// Runs one evaluation case through the full pipeline: analyzer -> simulated
// student answering the quiz -> grader -> scoring layer. Shared by the CLI
// (scripts/eval/run.ts) and the admin "Run test set" button.

import Anthropic from "@anthropic-ai/sdk";
import { generateQuiz, gradeAnswers, type QuizResult } from "../quiz";
import { scoreSubmission, type ScoreCard } from "../scoring";
import type { EvalCase } from "./cases";

const VAGUE = [
  "I think it was mostly about the main idea of the topic.",
  "It talks about why it was important and what happened because of it, I don't remember the details exactly.",
];

async function simulateAnswers(c: EvalCase, quiz: QuizResult): Promise<string[]> {
  if (c.student === "vague") return quiz.quiz.map((_, i) => VAGUE[i] ?? VAGUE[0]);
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const msg = await anthropic.messages.create({
    model: "claude-sonnet-5",
    max_tokens: 600,
    system:
      "You are a college student who genuinely wrote the work below and understands it. Answer each question briefly in your own words, as that student. Return one answer per line, no numbering, nothing else.",
    messages: [
      {
        role: "user",
        content: `YOUR SUBMITTED WORK:\n${c.submission}\n\nQUESTIONS:\n${quiz.quiz.map((q) => q.question).join("\n")}`,
      },
    ],
  });
  const text = msg.content.map((b) => (b.type === "text" ? b.text : "")).join("");
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  return quiz.quiz.map((_, i) => lines[i] ?? "");
}

export type CaseResult = {
  id: string;
  course: string;
  scenario: string;
  expect: EvalCase["expect"];
  why: string;
  actual: "review" | "no_review";
  correct: boolean | null; // null for borderline ("either") cases
  relianceExpected: EvalCase["expectReliance"] | null;
  relianceActual: "none" | "ideas" | "heavy" | "written";
  relianceCorrect: boolean | null; // null when the case has no reliance answer key
  card: ScoreCard;
  quiz: QuizResult;
  answers: string[];
};

export async function runCase(c: EvalCase): Promise<CaseResult> {
  const policy = `COURSE SYLLABUS / AI-USE POLICY:\n${c.syllabus}\n\n---\n\nTHIS ASSIGNMENT'S INSTRUCTIONS:\n${c.instructions}`;
  const quiz = await generateQuiz(c.transcript, policy, c.submission);
  const answers = await simulateAnswers(c, quiz);
  const comprehension = await gradeAnswers({ assignmentText: c.submission, transcript: c.transcript, quiz, answers });
  const card = scoreSubmission({ quiz, submissionText: c.submission, transcript: c.transcript, comprehension });
  const actual = card.needsReview ? "review" : "no_review";
  // Highest reliance level on any paragraph, disclosed or not.
  const rank = { none: 0, ideas: 1, heavy: 2, written: 3 } as const;
  const relianceActual = card.reliance.paragraphs.reduce<"none" | "ideas" | "heavy" | "written">(
    (best, p) => (rank[p.level] > rank[best] ? p.level : best),
    "none"
  );
  return {
    id: c.id,
    course: c.course,
    scenario: c.scenario,
    expect: c.expect,
    why: c.why,
    actual,
    correct: c.expect === "either" ? null : actual === c.expect,
    relianceExpected: c.expectReliance ?? null,
    relianceActual,
    relianceCorrect: c.expectReliance ? relianceActual === c.expectReliance : null,
    card,
    quiz,
    answers,
  };
}

export function summarize(results: CaseResult[]) {
  const judged = results.filter((r) => r.correct !== null);
  const correct = judged.filter((r) => r.correct).length;
  return {
    judged: judged.length,
    correct,
    accuracy: judged.length ? Math.round((100 * correct) / judged.length) : 0,
    falsePositives: judged.filter((r) => r.expect === "no_review" && r.actual === "review").map((r) => r.id),
    falseNegatives: judged.filter((r) => r.expect === "review" && r.actual === "no_review").map((r) => r.id),
    borderline: results.length - judged.length,
    relianceJudged: results.filter((r) => r.relianceCorrect !== null).length,
    relianceCorrect: results.filter((r) => r.relianceCorrect === true).length,
    relianceMisses: results
      .filter((r) => r.relianceCorrect === false)
      .map((r) => `${r.id} (expected ${r.relianceExpected}, got ${r.relianceActual})`),
  };
}
