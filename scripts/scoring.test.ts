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

// ---------------- scoring v3: weights comprehension 45 / reliance 30 / policy 25 ----------------

// Two paragraphs: the student's own, then an AI paragraph pasted in.
const twoPara = `${own}\n\n${aiPara}`;
const rate = (index: number, reliance: "none" | "ideas" | "heavy" | "written", over: Record<string, unknown> = {}) => ({
  index,
  reliance,
  disclosed: false,
  note: "n",
  ai_source_excerpt: reliance === "none" ? "" : aiPara,
  ...over,
});
const weak = (n: number) => ({
  passed: n === 0,
  note: "n",
  per_question: [0, 1].map((i) => ({ adequate: i >= n, reason: "" })),
});

t("clean submission scores 0, no review", () => {
  const c = scoreSubmission({
    quiz: { ...base, paragraphs: [rate(1, "none")] },
    submissionText: own,
    transcript: "User: hi",
    comprehension: weak(0),
  });
  assert.equal(c.score, 0);
  assert.equal(c.needsReview, false);
  assert.equal(c.reliance.percent.none, 100);
});

t("AI-written paragraph, undisclosed: reliance ~46% -> ~28/30", () => {
  const c = scoreSubmission({
    quiz: { ...base, ai_passages: [copied()], paragraphs: [rate(1, "none"), rate(2, "written")] },
    submissionText: twoPara,
    transcript,
  });
  assert.ok(c.reliance.reliance > 0.4 && c.reliance.reliance < 0.5, `reliance ${c.reliance.reliance}`);
  assert.ok(c.signals.reliance.points >= 26 && c.signals.reliance.points <= 30, `points ${c.signals.reliance.points}`);
  assert.match(c.signals.reliance.reason, /¶2 written by AI/);
});

t("copied text sets a floor even if the analyzer under-rates it", () => {
  const c = scoreSubmission({
    quiz: { ...base, ai_passages: [copied()], paragraphs: [rate(1, "none"), rate(2, "none")] },
    submissionText: twoPara,
    transcript,
  });
  assert.equal(c.reliance.paragraphs[1].level, "written");
  assert.equal(c.reliance.paragraphs[1].evidence, "copied-text");
});

t("'ideas' reliance with a verified AI source counts at 0.35", () => {
  const ideaPara = "Because the reparations were so harsh, I argue they destabilized the economy and made people resentful enough to back extremists.";
  const c = scoreSubmission({
    quiz: { ...base, paragraphs: [rate(1, "none"), rate(2, "ideas")] },
    submissionText: `${own}\n\n${ideaPara}`,
    transcript,
  });
  assert.equal(c.reliance.paragraphs[1].level, "ideas");
  assert.equal(c.reliance.paragraphs[1].evidence, "source");
  const expected = (0.35 * c.reliance.paragraphs[1].words) / (c.reliance.paragraphs[0].words + c.reliance.paragraphs[1].words);
  assert.ok(Math.abs(c.reliance.reliance - expected) < 0.01);
});

t("a rating with no real AI source (and no copied text) is rejected", () => {
  const c = scoreSubmission({
    quiz: { ...base, paragraphs: [rate(1, "heavy", { ai_source_excerpt: "Something the AI never actually said in this chat at all." })] },
    submissionText: own,
    transcript,
  });
  assert.equal(c.reliance.paragraphs[0].level, "none");
  assert.equal(c.reliance.rejected, 1);
  assert.equal(c.signals.reliance.points, 0);
});

t("citing the student's own message as the 'AI source' is rejected", () => {
  const tr = `User: Here's my draft: ${own}\nAssistant: Nice work, consider adding a source.`;
  const c = scoreSubmission({
    quiz: { ...base, paragraphs: [rate(1, "written", { ai_source_excerpt: own })] },
    submissionText: own,
    transcript: tr,
  });
  assert.equal(c.reliance.paragraphs[0].level, "none");
});

t("a real AI reply that's unrelated to the paragraph can't label it", () => {
  const brainstorm = "Possible angles: the war-guilt clause, territorial losses, or the weakness of the League of Nations.";
  const c = scoreSubmission({
    quiz: { ...base, paragraphs: [rate(1, "ideas", { ai_source_excerpt: brainstorm })] },
    submissionText: own,
    transcript: `User: angles?\nAssistant: ${brainstorm}`,
  });
  assert.equal(c.reliance.paragraphs[0].level, "none");
  assert.equal(c.reliance.rejected, 1);
});

t("measured cap: 'heavy' with few shared key words becomes 'ideas'", () => {
  const argument = "One overlooked factor is the stab-in-the-back myth: because civilian politicians signed the treaty, nationalists could blame the Weimar Republic rather than the army for defeat.";
  const ownWords = "What stood out to me is that nationalists got to shift the blame. Since civilians signed it, people could pretend the army never really lost, and that lie made the republic look like traitors.";
  const c = scoreSubmission({
    quiz: { ...base, paragraphs: [rate(1, "heavy", { ai_source_excerpt: argument })] },
    submissionText: ownWords,
    transcript: `User: angle?\nAssistant: ${argument}`,
  });
  assert.equal(c.reliance.paragraphs[0].level, "ideas");
  assert.equal(c.reliance.paragraphs[0].adjustedFrom, "heavy");
});

t("measured cap: 'written' that's only paraphrased becomes 'heavy'", () => {
  const src = "Kant's critics, most famously Benjamin Constant, argued that the duty to tell the truth applies only to those who have a right to the truth, and a murderer seeking a victim has forfeited that right.";
  const para = "Kant's critics, most famously Benjamin Constant, said the duty to tell the truth only applies to people who have a right to the truth, and a murderer looking for a victim has forfeited that right.";
  const c = scoreSubmission({
    quiz: { ...base, paragraphs: [rate(1, "written", { ai_source_excerpt: src })] },
    submissionText: para,
    transcript: `User: explain\nAssistant: ${src}`,
  });
  assert.equal(c.reliance.paragraphs[0].level, "heavy");
});

t("measured cap never lowers verified copied text below 'written'", () => {
  const c = scoreSubmission({
    quiz: { ...base, ai_passages: [copied()], paragraphs: [rate(1, "none"), rate(2, "written")] },
    submissionText: twoPara,
    transcript,
  });
  assert.equal(c.reliance.paragraphs[1].level, "written");
});

t("disclosed reliance is shown but scores 0", () => {
  const c = scoreSubmission({
    quiz: { ...base, ai_passages: [copied({ claimed_as_own: false })], paragraphs: [rate(1, "none"), rate(2, "written", { disclosed: true })] },
    submissionText: twoPara,
    transcript,
  });
  assert.equal(c.signals.reliance.points, 0);
  assert.ok(c.reliance.disclosedReliance > 0.4);
  assert.ok(c.reliance.percent.disclosed > 40);
});

t("analyzer says 'disclosed' but undisclosed copied text is proven: counts", () => {
  const c = scoreSubmission({
    quiz: { ...base, ai_passages: [copied()], paragraphs: [rate(1, "none"), rate(2, "written", { disclosed: true })] },
    submissionText: twoPara,
    transcript,
  });
  assert.equal(c.reliance.paragraphs[1].disclosed, false);
  assert.ok(c.signals.reliance.points > 20);
});

t("weights: one weak answer alone = 23, no review", () => {
  const c = scoreSubmission({ quiz: base, submissionText: own, transcript, comprehension: weak(1) });
  assert.equal(c.score, 23);
  assert.equal(c.needsReview, false);
});

t("weights: both answers weak alone = 45, review", () => {
  const c = scoreSubmission({ quiz: base, submissionText: own, transcript, comprehension: weak(2) });
  assert.equal(c.score, 45);
  assert.equal(c.needsReview, true);
});

t("weights: clear policy concern alone = 25, review via maxed rule", () => {
  const c = scoreSubmission({ quiz: { ...base, policy_concern: "AI drafted paragraph 2.", policy_severity: "clear" }, submissionText: own, transcript });
  assert.equal(c.score, 25);
  assert.equal(c.needsReview, true);
});

t("weights: minor policy concern alone = 13, no review", () => {
  const c = scoreSubmission({ quiz: { ...base, policy_concern: "Light AI rewording.", policy_severity: "minor" }, submissionText: own, transcript });
  assert.equal(c.score, 13);
  assert.equal(c.needsReview, false);
});

t("weak answer + AI-written paragraph together reach review", () => {
  const c = scoreSubmission({
    quiz: { ...base, ai_passages: [copied()], paragraphs: [rate(1, "none"), rate(2, "written")] },
    submissionText: twoPara,
    transcript,
    comprehension: weak(1),
  });
  assert.ok(c.score >= 40, `score ${c.score}`);
  assert.equal(c.needsReview, true);
});

t("everything maxed: 100", () => {
  const all = `${aiPara}`;
  const c = scoreSubmission({
    quiz: { ...base, policy_concern: "x", policy_severity: "clear", ai_passages: [copied()], paragraphs: [rate(1, "written")] },
    submissionText: all,
    transcript,
    comprehension: weak(2),
  });
  assert.equal(c.score, 100);
});

t("legacy analysis (no passages, no ratings) shows 'Not checked'", () => {
  const legacy = { ...base, policy_severity: undefined, ai_passages: undefined, paragraphs: undefined, usage_summary: undefined, policy_concern: "AI wrote it." };
  const c = scoreSubmission({ quiz: legacy, submissionText: own, transcript });
  assert.equal(c.signals.policy.value, 1);
  assert.match(c.signals.reliance.reason, /Not checked/);
});

t("v2 analysis (passages, no ratings) still scores from copied text", () => {
  const c = scoreSubmission({ quiz: { ...base, ai_passages: [copied()], paragraphs: undefined }, submissionText: twoPara, transcript });
  assert.equal(c.reliance.legacy, true);
  assert.equal(c.reliance.paragraphs[1].level, "written");
  assert.ok(c.signals.reliance.points > 20);
});

t("paragraph splitting falls back to single newlines", () => {
  const c = scoreSubmission({ quiz: base, submissionText: `${own}\n${aiPara}`, transcript });
  assert.equal(c.reliance.paragraphs.length, 2);
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
  // The paraphrase alone floors its paragraph to at least "heavy".
  assert.ok(c.signals.reliance.points > 0);
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
