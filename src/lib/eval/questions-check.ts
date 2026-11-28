// Quiz question check: are the two comprehension questions sharp enough to
// tell a student who did the work from one who didn't?
//
// For each case: write the questions the way production does, check them in
// code (one sentence, real paragraph, answer key, not hypothetical), then let
// two simulated students answer:
//   author  - has the submission in front of them (should pass)
//   bluffer - knows only the assignment prompt and the subject (should fail)
// and grade both with the production grader. A question is "sharp" when the
// author passes it and the bluffer doesn't.

import { callClaude, MODELS, withAiContext } from "../ai";
import { splitParagraphs } from "../paragraphs";
import { gradeAnswers, questionProblems, writeQuizQuestions, type QuizQuestion, type QuizResult } from "../quiz";
import type { EvalCase } from "./cases";
import type { QuestionCheckResult, QuestionVerdict } from "./questions-shared";
export { QUESTION_CASES, summarizeQuestions, type QuestionCheckResult, type QuestionVerdict } from "./questions-shared";

const words = (t: string) =>
  new Set(
    t
      .toLowerCase()
      .replace(/[^a-z0-9.\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length >= 4)
  );

function share(of: string, inText: string): number {
  const a = words(of);
  if (!a.size) return 0;
  const b = words(inText);
  let hit = 0;
  for (const w of a) if (b.has(w)) hit++;
  return hit / a.size;
}

const assistantText = (transcript: string) =>
  transcript
    .split("\n")
    .filter((l) => /^(assistant|ai|chatgpt|claude)\s*:/i.test(l.trim()))
    .join("\n");

async function simulate(kind: "author" | "bluffer", c: EvalCase, questions: QuizQuestion[]): Promise<string[]> {
  const system =
    kind === "author"
      ? "You are the college student who wrote the work below and understands it. Answer each question in ONE sentence, in your own words. Return one answer per line, no numbering, nothing else."
      : "You are a college student who did NOT do this assignment yourself; you only know the assignment prompt and the general subject. Answer each question in ONE sentence with your most plausible guess, sounding confident. Never say you don't know. Return one answer per line, no numbering, nothing else.";
  const context =
    kind === "author"
      ? `YOUR SUBMITTED WORK:\n${c.submission}`
      : `COURSE: ${c.course}\nASSIGNMENT: ${c.instructions}`;
  const msg = await callClaude("eval", {
    model: MODELS.fast,
    max_tokens: 400,
    system,
    messages: [{ role: "user", content: `${context}\n\nQUESTIONS:\n${questions.map((q) => q.question).join("\n")}` }],
  });
  const lines = msg.content
    .map((b) => (b.type === "text" ? b.text : ""))
    .join("")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  return questions.map((_, i) => lines[i] ?? "");
}

export async function checkQuestions(c: EvalCase): Promise<QuestionCheckResult> {
  const tally = { costUsd: 0, calls: 0 };
  const questions = await withAiContext({ step: "eval", tally }, async () => {
    const policy = `COURSE SYLLABUS / AI-USE POLICY:\n${c.syllabus}\n\n---\n\nTHIS ASSIGNMENT'S INSTRUCTIONS:\n${c.instructions}`;
    const { quiz } = await writeQuizQuestions(c.transcript, policy, c.submission);
    const paragraphs = splitParagraphs(c.submission);
    const problems = questionProblems(quiz, paragraphs.length);
    const [authorAnswers, bluffAnswers] = await Promise.all([simulate("author", c, quiz), simulate("bluffer", c, quiz)]);
    const asQuiz = { quiz, claimed_unassisted_areas: [] } as unknown as QuizResult;
    const [authorGrade, bluffGrade] = await Promise.all([
      gradeAnswers({ assignmentText: c.submission, transcript: c.transcript, quiz: asQuiz, answers: authorAnswers }),
      gradeAnswers({ assignmentText: c.submission, transcript: c.transcript, quiz: asQuiz, answers: bluffAnswers }),
    ]);
    const ai = assistantText(c.transcript);
    return quiz.map((q, i): QuestionVerdict => {
      const para = paragraphs.find((p) => p.index === q.paragraph)?.text ?? "";
      return {
        ...q,
        problems: problems.filter((p) => p.startsWith(`Question ${i + 1}`) || !p.startsWith("Question")),
        grounded: !!para && !!q.answer_key && share(q.answer_key, para) >= 0.5,
        onAiParagraph: !!para && !!ai && share(para, ai) >= 0.6,
        authorAnswer: authorAnswers[i] ?? "",
        bluffAnswer: bluffAnswers[i] ?? "",
        authorOk: authorGrade.per_question?.[i]?.adequate ?? false,
        bluffOk: bluffGrade.per_question?.[i]?.adequate ?? false,
      };
    });
  });
  return { id: c.id, course: c.course, scenario: c.scenario, questions, costUsd: tally.costUsd };
}

