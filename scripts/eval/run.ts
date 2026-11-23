// Runs the full Luminatra pipeline (analyzer -> simulated student quiz
// answers -> grader -> scoring layer) on the evaluation set and reports how
// often the review decision matches the expected outcome.
//
// Run:  ANTHROPIC_API_KEY=sk-... npx tsx scripts/eval/run.ts [case-id-prefix]
// Cost: roughly 3 model calls per case (~90 for the full set).

import Anthropic from "@anthropic-ai/sdk";
import { writeFileSync } from "node:fs";
import { generateQuiz, gradeAnswers, type QuizResult } from "../../src/lib/quiz";
import { scoreSubmission, REVIEW_THRESHOLD, WEIGHTS, SCORING_VERSION } from "../../src/lib/scoring";
import { CASES, type EvalCase } from "./cases";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const VAGUE = [
  "I think it was mostly about the main idea of the topic.",
  "It talks about why it was important and what happened because of it, I don't remember the details exactly.",
];

async function simulateAnswers(c: EvalCase, quiz: QuizResult): Promise<string[]> {
  if (c.student === "vague") return quiz.quiz.map((_, i) => VAGUE[i] ?? VAGUE[0]);
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

async function runCase(c: EvalCase) {
  const policy = `COURSE SYLLABUS / AI-USE POLICY:\n${c.syllabus}\n\n---\n\nTHIS ASSIGNMENT'S INSTRUCTIONS:\n${c.instructions}`;
  const quiz = await generateQuiz(c.transcript, policy, c.submission);
  const answers = await simulateAnswers(c, quiz);
  const comprehension = await gradeAnswers({ assignmentText: c.submission, transcript: c.transcript, quiz, answers });
  const card = scoreSubmission({ quiz, submissionText: c.submission, transcript: c.transcript, comprehension });
  const actual = card.needsReview ? "review" : "no_review";
  const correct = c.expect === "either" ? null : actual === c.expect;
  return { c, card, actual, correct, quiz, answers };
}

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("Set ANTHROPIC_API_KEY first.");
    process.exit(1);
  }
  const prefix = process.argv[2] ?? "";
  const cases = CASES.filter((c) => c.id.startsWith(prefix));
  console.log(
    `Scoring ${SCORING_VERSION} | weights text ${WEIGHTS.textMatch} / policy ${WEIGHTS.policy} / comprehension ${WEIGHTS.comprehension} | threshold ${REVIEW_THRESHOLD}\nRunning ${cases.length} cases...\n`
  );

  const results = [];
  // Small concurrency to stay friendly with rate limits.
  for (let i = 0; i < cases.length; i += 3) {
    const batch = await Promise.all(
      cases.slice(i, i + 3).map((c) =>
        runCase(c).catch((e) => ({ c, error: e instanceof Error ? e.message : String(e) }))
      )
    );
    for (const r of batch) {
      results.push(r);
      if ("error" in r) {
        console.log(`ERR  ${r.c.id}  ${r.error}`);
        continue;
      }
      const s = r.card.signals;
      const mark = r.correct === null ? "~  " : r.correct ? "ok " : "XX ";
      console.log(
        `${mark} ${r.c.id}  score ${String(r.card.score).padStart(3)}  [text ${s.textMatch.points} | policy ${s.policy.points} | comp ${s.comprehension.points}]  expect ${r.c.expect.padEnd(9)} got ${r.actual.padEnd(9)} ${r.c.scenario}`
      );
    }
  }

  const scored = results.filter((r): r is Exclude<typeof r, { error: string }> => !("error" in r));
  const judged = scored.filter((r) => r.correct !== null);
  const correct = judged.filter((r) => r.correct).length;
  const fp = judged.filter((r) => r.c.expect === "no_review" && r.actual === "review");
  const fn = judged.filter((r) => r.c.expect === "review" && r.actual === "no_review");

  console.log(`\nAccuracy: ${correct}/${judged.length} (${Math.round((100 * correct) / Math.max(1, judged.length))}%)`);
  console.log(`Unneeded reviews (false positives): ${fp.length}${fp.length ? "  " + fp.map((r) => r.c.id).join(", ") : ""}`);
  console.log(`Missed reviews (false negatives):   ${fn.length}${fn.length ? "  " + fn.map((r) => r.c.id).join(", ") : ""}`);
  console.log(`Borderline (not scored): ${scored.length - judged.length}  Errors: ${results.length - scored.length}`);

  const out = `scripts/eval/results-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-")}.json`;
  writeFileSync(out, JSON.stringify(scored.map(({ c, card, actual, correct, quiz, answers }) => ({ id: c.id, expect: c.expect, actual, correct, card, quiz, answers })), null, 2));
  console.log(`Details: ${out}`);
}

void main();
