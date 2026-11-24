// Run: npx tsx scripts/scoring.test.ts
import assert from "node:assert/strict";
import { scoreSubmission } from "../src/lib/scoring";
import { buildContributionMap } from "../src/lib/contribution";
import type { QuizResult, AiPassage } from "../src/lib/quiz";

const base: QuizResult = {
  policy_summary: "AI may brainstorm but not draft.",
  policy_concern: "",
  policy_severity: "none",
  ai_passages: [],
  usage_summary: "",
  claimed_unassisted_areas: ["thesis"],
  quiz: [],
};

// ~19 words written by the AI, ~22 written by the student.
const aiPara =
  "The Treaty of Versailles imposed punitive reparations that destabilized the Weimar economy and fueled resentment across German society.";
const own =
  "I think the treaty mattered because my grandfather talked about it a lot and it shaped how people voted later on.";
const transcript = `User: help me with my essay\nAssistant: ${aiPara}`;
const submission = `${own} ${aiPara}`;

const copied = (over: Partial<AiPassage> = {}): AiPassage => ({
  submission_excerpt: aiPara,
  transcript_excerpt: aiPara,
  kind: "verbatim",
  claimed_as_own: true,
  ...over,
});

let passed = 0;
function t(name: string, fn: () => void) {
  fn();
  passed++;
  console.log("ok -", name);
}

// ---------------- scoring (v1 behavior preserved) ----------------

t("clean submission scores 0, no review, 100% student", () => {
  const c = scoreSubmission({
    quiz: base,
    submissionText: own,
    transcript: "User: hi",
    comprehension: { passed: true, note: "Fine.", per_question: [{ adequate: true, reason: "" }, { adequate: true, reason: "" }] },
  });
  assert.equal(c.score, 0);
  assert.equal(c.needsReview, false);
  assert.equal(c.contribution.percent.student, 100);
});

t("undisclosed copied AI text maxes text match", () => {
  const c = scoreSubmission({ quiz: { ...base, ai_passages: [copied()] }, submissionText: submission, transcript });
  assert.equal(c.signals.textMatch.value, 1);
  assert.equal(c.score, 45);
  assert.equal(c.needsReview, true);
  assert.match(c.signals.textMatch.reason, /% copied from AI, not disclosed/);
  assert.ok(c.contribution.percent.copied > 40 && c.contribution.percent.copied < 55);
});

t("disclosed AI text: 0 points, shown as AI-assisted", () => {
  const c = scoreSubmission({ quiz: { ...base, ai_passages: [copied({ claimed_as_own: false })] }, submissionText: submission, transcript });
  assert.equal(c.score, 0);
  assert.equal(c.contribution.words.copied, 0);
  assert.ok(c.contribution.words.assisted > 0);
});

t("student's own words claimed as AI (not in transcript) are rejected", () => {
  const c = scoreSubmission({
    quiz: { ...base, ai_passages: [copied({ submission_excerpt: own, transcript_excerpt: own })] },
    submissionText: submission,
    transcript,
  });
  assert.equal(c.signals.textMatch.value, 0);
  assert.equal(c.contribution.rejected, 1);
});

t("excerpt that isn't in the submission is rejected", () => {
  const fake = "The treaty made Germany pay huge reparations which wrecked the economy and made everyone angry about it.";
  const c = scoreSubmission({
    quiz: { ...base, ai_passages: [copied({ submission_excerpt: fake, transcript_excerpt: fake })] },
    submissionText: submission,
    transcript: transcript + " " + fake,
  });
  assert.equal(c.signals.textMatch.value, 0);
});

t("case and punctuation changes still match", () => {
  const c = scoreSubmission({
    quiz: { ...base, ai_passages: [copied({ submission_excerpt: aiPara.toUpperCase().replace(/,/g, ";") })] },
    submissionText: submission,
    transcript,
  });
  assert.equal(c.signals.textMatch.value, 1);
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
  const c = scoreSubmission({
    quiz: base,
    submissionText: own,
    transcript,
    comprehension: { passed: false, note: "Q2 vague.", per_question: [{ adequate: true, reason: "" }, { adequate: false, reason: "vague" }] },
  });
  assert.equal(c.score, 13);
  assert.equal(c.needsReview, false);
});

t("both quiz answers weak alone: 25, review (maxed)", () => {
  const c = scoreSubmission({
    quiz: base,
    submissionText: own,
    transcript,
    comprehension: { passed: false, note: "Both vague.", per_question: [{ adequate: false, reason: "" }, { adequate: false, reason: "" }] },
  });
  assert.equal(c.score, 25);
  assert.equal(c.needsReview, true);
});

t("everything maxed: 100", () => {
  const c = scoreSubmission({
    quiz: { ...base, policy_concern: "x", policy_severity: "clear", ai_passages: [copied()] },
    submissionText: submission,
    transcript,
    comprehension: { passed: false, note: "n", per_question: [{ adequate: false, reason: "" }, { adequate: false, reason: "" }] },
  });
  assert.equal(c.score, 100);
});

t("legacy analysis (no passages field) shows 'Not checked'", () => {
  const legacy = { ...base, policy_severity: undefined, ai_passages: undefined, usage_summary: undefined, policy_concern: "AI wrote it." };
  const c = scoreSubmission({ quiz: legacy, submissionText: own, transcript });
  assert.equal(c.signals.policy.value, 1);
  assert.match(c.signals.textMatch.reason, /Not checked/);
});

t("v1-format passages (no kind/source) still count as copies", () => {
  const c = scoreSubmission({
    quiz: { ...base, ai_passages: [{ submission_excerpt: aiPara, claimed_as_own: true }] },
    submissionText: submission,
    transcript,
  });
  assert.equal(c.signals.textMatch.value, 1);
  assert.equal(c.contribution.legacy, true);
});

// ---------------- contribution map ----------------

const aiReply =
  "Reparations under the treaty crippled the German economy, producing hyperinflation and a deep sense of national humiliation that extremist parties exploited.";
const paraphrase =
  "The treaty's reparations crippled Germany's economy, causing hyperinflation and a national humiliation that extremist parties were able to exploit.";

t("paraphrase: verified against its source, half weight", () => {
  const sub = `${own} ${paraphrase}`;
  const tr = `User: explain reparations\nAssistant: ${aiReply}`;
  const c = scoreSubmission({
    quiz: { ...base, ai_passages: [{ submission_excerpt: paraphrase, transcript_excerpt: aiReply, kind: "paraphrased", claimed_as_own: true }] },
    submissionText: sub,
    transcript: tr,
  });
  const m = c.contribution;
  assert.ok(m.words.paraphrased > 15, `paraphrased words ${m.words.paraphrased}`);
  assert.equal(m.words.copied, 0);
  // ~19 of ~41 words paraphrased -> share ~0.23 after half weight -> value ~0.77
  assert.ok(c.signals.textMatch.value > 0.6 && c.signals.textMatch.value < 0.9, `value ${c.signals.textMatch.value}`);
  assert.match(c.signals.textMatch.reason, /closely paraphrased/);
});

t("paraphrase whose 'source' isn't in the transcript is rejected", () => {
  const c = buildContributionMap({
    submission: `${own} ${paraphrase}`,
    transcript: "User: hi\nAssistant: Sure, happy to help with your essay on any topic you like.",
    passages: [{ submission_excerpt: paraphrase, transcript_excerpt: aiReply, kind: "paraphrased", claimed_as_own: true }],
  });
  assert.equal(c.words.paraphrased, 0);
  assert.equal(c.rejected, 1);
});

t("paraphrase paired with an unrelated AI reply is rejected", () => {
  const unrelated = "Photosynthesis converts light energy into chemical energy stored in glucose molecules within plant chloroplasts.";
  const c = buildContributionMap({
    submission: `${own} ${paraphrase}`,
    transcript: `User: x\nAssistant: ${unrelated}`,
    passages: [{ submission_excerpt: paraphrase, transcript_excerpt: unrelated, kind: "paraphrased", claimed_as_own: true }],
  });
  assert.equal(c.words.paraphrased, 0);
});

t("AI polishing the student's own draft is 'assisted', never scored", () => {
  const draft = "the treaty made alot of germans really angry at there goverment and that was bad";
  const polished = "The treaty made many Germans deeply angry at their government, which had serious consequences.";
  const c = scoreSubmission({
    quiz: { ...base, ai_passages: [{ submission_excerpt: polished, transcript_excerpt: polished, kind: "edited", claimed_as_own: true }] },
    submissionText: `${own} ${polished}`,
    transcript: `User: fix my grammar: ${draft}\nAssistant: ${polished}`,
  });
  assert.equal(c.score, 0);
  assert.ok(c.contribution.words.assisted > 0);
});

t("overlapping/duplicate proposals don't double count", () => {
  const half = aiPara.split(" ").slice(0, 10).join(" ");
  const c = buildContributionMap({
    submission: submission,
    transcript,
    passages: [copied(), copied(), copied({ submission_excerpt: half, transcript_excerpt: half })],
  });
  const total = c.words.student + c.words.copied + c.words.paraphrased + c.words.assisted;
  assert.equal(total, c.totalWords);
  assert.ok(c.words.copied <= 19);
});

t("highlight spans point at the right text", () => {
  const c = buildContributionMap({ submission, transcript, passages: [copied()] });
  assert.equal(c.segments.length, 1);
  const seg = c.segments[0];
  assert.equal(submission.slice(seg.start, seg.end), aiPara.replace(/\.$/, ""));
  assert.equal(seg.kind, "copied");
  assert.equal(c.sources[seg.source].transcriptExcerpt, aiPara);
});

t("percentages add up to ~100", () => {
  const c = buildContributionMap({ submission, transcript, passages: [copied()] });
  const p = c.percent;
  assert.ok(Math.abs(p.student + p.copied + p.paraphrased + p.assisted - 100) <= 2);
});

t("summary passes through", () => {
  const c = buildContributionMap({ submission: own, transcript, passages: [], summary: " Used AI to brainstorm. " });
  assert.equal(c.summary, "Used AI to brainstorm.");
});

t("student's own draft pasted into the chat is never 'AI text'", () => {
  const tr = `User: Here's my draft, any feedback? ${own}\nAssistant: Your thesis is clear. Consider adding a source for the voting claim.`;
  const c = buildContributionMap({
    submission: own,
    transcript: tr,
    passages: [{ submission_excerpt: own, transcript_excerpt: own, kind: "verbatim", claimed_as_own: true }],
  });
  assert.equal(c.speakersDetected, true);
  assert.equal(c.words.copied, 0);
  assert.equal(c.rejected, 1);
});

t("ChatGPT 'You said / ChatGPT said' export format is recognized", () => {
  const tr = `You said:\nwrite me a paragraph on the treaty\nChatGPT said:\n${aiPara}`;
  const c = buildContributionMap({ submission, transcript: tr, passages: [copied()] });
  assert.equal(c.speakersDetected, true);
  assert.ok(c.words.copied > 15);
});

t("unlabeled transcript falls back to the whole text", () => {
  const c = buildContributionMap({ submission, transcript: `asked for help and got: ${aiPara}`, passages: [copied()] });
  assert.equal(c.speakersDetected, false);
  assert.ok(c.words.copied > 15);
});

console.log(`\n${passed} scoring tests passed`);
