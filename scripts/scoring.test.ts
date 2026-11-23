// Run: npx tsx scripts/scoring.test.ts
import assert from "node:assert/strict";
import { scoreSubmission, verifyExcerpt, normalize } from "../src/lib/scoring";
import type { QuizResult } from "../src/lib/quiz";

const base: QuizResult = {
  policy_summary: "AI may brainstorm but not draft.",
  policy_concern: "",
  policy_severity: "none",
  ai_passages: [],
  claimed_unassisted_areas: ["thesis"],
  quiz: [],
};
const aiPara =
  "The Treaty of Versailles imposed punitive reparations that destabilized the Weimar economy and fueled resentment across German society.";
const own = "I think the treaty mattered because my grandfather talked about it a lot and it shaped how people voted later on.";
const transcript = `User: help me with my essay\nAssistant: ${aiPara}`;
const submission = `${own} ${aiPara}`;

let passed = 0;
function t(name: string, fn: () => void) {
  fn();
  passed++;
  console.log("ok -", name);
}

t("clean submission scores 0, no review", () => {
  const c = scoreSubmission({ quiz: base, submissionText: own, transcript: "User: hi", comprehension: { passed: true, note: "Fine.", per_question: [{ adequate: true, reason: "" }, { adequate: true, reason: "" }] } });
  assert.equal(c.score, 0);
  assert.equal(c.needsReview, false);
});

t("verified undisclosed AI text counts", () => {
  const c = scoreSubmission({ quiz: { ...base, ai_passages: [{ submission_excerpt: aiPara, claimed_as_own: true }] }, submissionText: submission, transcript });
  // ~19 of ~41 words => share ~0.46 > 0.3 => maxed
  assert.equal(c.signals.textMatch.value, 1);
  assert.equal(c.score, 45);
  assert.equal(c.needsReview, true);
});

t("disclosed AI text adds nothing", () => {
  const c = scoreSubmission({ quiz: { ...base, ai_passages: [{ submission_excerpt: aiPara, claimed_as_own: false }] }, submissionText: submission, transcript });
  assert.equal(c.score, 0);
});

t("hallucinated excerpt (not in transcript) is rejected", () => {
  const c = scoreSubmission({ quiz: { ...base, ai_passages: [{ submission_excerpt: own, claimed_as_own: true }] }, submissionText: submission, transcript });
  assert.equal(c.signals.textMatch.value, 0);
});

t("paraphrased excerpt not in submission is rejected", () => {
  const fake = "The treaty made Germany pay huge reparations which wrecked the economy and made everyone angry about it.";
  const c = scoreSubmission({ quiz: { ...base, ai_passages: [{ submission_excerpt: fake, claimed_as_own: true }] }, submissionText: submission, transcript: transcript + " " + fake });
  assert.equal(c.signals.textMatch.value, 0);
});

t("lightly edited copy (punctuation/case) still verifies", () => {
  const n = verifyExcerpt(aiPara.toUpperCase().replace(/,/g, ";"), normalize(submission), normalize(transcript), new Set(), new Set());
  assert.ok(n >= 8);
});

t("clear policy concern alone: 30 points but still goes to review (maxed signal)", () => {
  const c = scoreSubmission({ quiz: { ...base, policy_concern: "AI drafted paragraph 2.", policy_severity: "clear" }, submissionText: own, transcript });
  assert.equal(c.score, 30);
  assert.equal(c.needsReview, true);
});

t("minor policy concern alone: 15, no review", () => {
  const c = scoreSubmission({ quiz: { ...base, policy_concern: "Light AI rewording.", policy_severity: "minor" }, submissionText: own, transcript });
  assert.equal(c.score, 15);
  assert.equal(c.needsReview, false);
});

t("one weak quiz answer alone: 13, no review", () => {
  const c = scoreSubmission({ quiz: base, submissionText: own, transcript, comprehension: { passed: false, note: "Q2 vague.", per_question: [{ adequate: true, reason: "" }, { adequate: false, reason: "vague" }] } });
  assert.equal(c.score, 13);
  assert.equal(c.needsReview, false);
});

t("both quiz answers weak alone: 25, review (maxed)", () => {
  const c = scoreSubmission({ quiz: base, submissionText: own, transcript, comprehension: { passed: false, note: "Both vague.", per_question: [{ adequate: false, reason: "" }, { adequate: false, reason: "" }] } });
  assert.equal(c.score, 25);
  assert.equal(c.needsReview, true);
});

t("minor policy + one weak answer: 28, no review", () => {
  const c = scoreSubmission({ quiz: { ...base, policy_concern: "x", policy_severity: "minor" }, submissionText: own, transcript, comprehension: { passed: false, note: "n", per_question: [{ adequate: true, reason: "" }, { adequate: false, reason: "" }] } });
  assert.equal(c.score, 28);
  assert.equal(c.needsReview, false);
});

t("everything maxed: 100", () => {
  const c = scoreSubmission({ quiz: { ...base, policy_concern: "x", policy_severity: "clear", ai_passages: [{ submission_excerpt: aiPara, claimed_as_own: true }] }, submissionText: submission, transcript, comprehension: { passed: false, note: "n", per_question: [{ adequate: false, reason: "" }, { adequate: false, reason: "" }] } });
  assert.equal(c.score, 100);
});

t("legacy analysis (no severity/passages) with concern treated as clear", () => {
  const legacy = { ...base, policy_severity: undefined, ai_passages: undefined, policy_concern: "AI wrote it." };
  const c = scoreSubmission({ quiz: legacy, submissionText: own, transcript });
  assert.equal(c.signals.policy.value, 1);
  assert.match(c.signals.textMatch.reason, /Not checked/);
});

console.log(`\n${passed} scoring tests passed`);
