// Luminatra's scoring layer: turns the three signals into a 0–100
// "follow-up priority". The AI only *proposes* evidence (passages, severity,
// answer adequacy); this file decides what counts and how much, using fixed,
// documented rules, so every score can be explained line by line.
//
// It is never a probability of cheating. It ranks which submissions a teacher
// may want to look at first.

import type { QuizResult, ComprehensionResult } from "./quiz";

export const SCORING_VERSION = "v1";

export const WEIGHTS = { textMatch: 45, policy: 30, comprehension: 25 } as const;

// Submissions at or above this score go to "Needs review".
export const REVIEW_THRESHOLD = 40;

// Share of the submission that, if AI-written and presented as the student's
// own, maxes out the text-match signal.
const TEXT_MATCH_FULL_SHARE = 0.3;

// Excerpts shorter than this are ignored — too short to be meaningful evidence.
const MIN_EXCERPT_WORDS = 8;
const SHINGLE = 8;

export type SignalKey = keyof typeof WEIGHTS;

export type Signal = {
  value: number; // 0..1
  points: number; // value * weight, rounded
  max: number; // the weight
  reason: string; // one line for the teacher; empty if nothing notable
  pending?: boolean; // not computed yet (e.g. quiz not answered)
};

export type ScoreCard = {
  version: string;
  score: number; // 0..100
  needsReview: boolean;
  signals: Record<SignalKey, Signal>;
};

// ---------------------------------------------------------------------------
// Text normalization and passage verification

export function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[^a-z0-9']+/g, " ")
    .trim();
}

function words(norm: string): string[] {
  return norm ? norm.split(" ") : [];
}

function shingles(ws: string[], n = SHINGLE): Set<string> {
  const out = new Set<string>();
  for (let i = 0; i + n <= ws.length; i++) out.add(ws.slice(i, i + n).join(" "));
  return out;
}

/**
 * An AI-proposed excerpt only counts if it really appears in BOTH the
 * submission and the transcript — exact (after normalization) or, failing
 * that, with at least 80% of its 8-word runs found in each. This stops the
 * model from inventing or paraphrasing evidence.
 */
export function verifyExcerpt(
  excerpt: string,
  submissionNorm: string,
  transcriptNorm: string,
  submissionShingles: Set<string>,
  transcriptShingles: Set<string>
): number {
  const norm = normalize(excerpt);
  const ws = words(norm);
  if (ws.length < MIN_EXCERPT_WORDS) return 0;
  if (submissionNorm.includes(norm) && transcriptNorm.includes(norm)) return ws.length;

  const own = shingles(ws);
  if (own.size === 0) return 0;
  let inSub = 0;
  let inTr = 0;
  for (const sh of own) {
    if (submissionShingles.has(sh)) inSub++;
    if (transcriptShingles.has(sh)) inTr++;
  }
  return inSub / own.size >= 0.8 && inTr / own.size >= 0.8 ? ws.length : 0;
}

// ---------------------------------------------------------------------------
// Individual signals

function textMatchSignal(quiz: QuizResult, submission: string, transcript: string): Signal {
  const max = WEIGHTS.textMatch;
  if (!quiz.ai_passages) {
    return { value: 0, points: 0, max, reason: "Not checked (analyzed before text matching existed)." };
  }
  const subNorm = normalize(submission);
  const trNorm = normalize(transcript);
  const subWords = words(subNorm).length;
  if (subWords === 0) return { value: 0, points: 0, max, reason: "" };

  const subSh = shingles(words(subNorm));
  const trSh = shingles(words(trNorm));

  // De-duplicate overlapping excerpts by counting each verified excerpt once.
  const seen = new Set<string>();
  let claimedWords = 0;
  let disclosedWords = 0;
  for (const p of quiz.ai_passages) {
    const key = normalize(p.submission_excerpt);
    if (seen.has(key)) continue;
    seen.add(key);
    const n = verifyExcerpt(p.submission_excerpt, subNorm, trNorm, subSh, trSh);
    if (p.claimed_as_own) claimedWords += n;
    else disclosedWords += n;
  }

  const share = Math.min(1, claimedWords / subWords);
  const value = Math.min(1, share / TEXT_MATCH_FULL_SHARE);
  const pct = Math.round(share * 100);
  // Disclosed AI passages are tracked but don't add to the score: openly
  // disclosed help is a syllabus question, handled by the policy signal.
  void disclosedWords;
  const reason =
    claimedWords > 0
      ? `About ${pct}% of the submission matches AI-written text from the transcript that isn't disclosed as AI help.`
      : "";
  return { value, points: Math.round(value * max), max, reason };
}

function policySignal(quiz: QuizResult): Signal {
  const max = WEIGHTS.policy;
  const concern = quiz.policy_concern?.trim() ?? "";
  let value = 0;
  if (quiz.policy_severity) {
    value = quiz.policy_severity === "clear" ? 1 : quiz.policy_severity === "minor" ? 0.5 : 0;
  } else if (concern) {
    value = 1; // older analyses had no severity; any concern was a clear one
  }
  if (value > 0 && !concern) value = 0; // severity without a stated concern isn't actionable
  return { value, points: Math.round(value * max), max, reason: value > 0 ? concern : "" };
}

function comprehensionSignal(comprehension: ComprehensionResult | undefined): Signal {
  const max = WEIGHTS.comprehension;
  if (!comprehension) return { value: 0, points: 0, max, reason: "", pending: true };
  const qs = comprehension.per_question ?? [];
  let value: number;
  if (qs.length > 0) value = qs.filter((q) => !q.adequate).length / qs.length;
  else value = comprehension.passed ? 0 : 1;
  return { value, points: Math.round(value * max), max, reason: value > 0 ? comprehension.note : "" };
}

// ---------------------------------------------------------------------------

export function scoreSubmission(input: {
  quiz: QuizResult;
  submissionText: string;
  transcript: string;
  comprehension?: ComprehensionResult;
}): ScoreCard {
  const signals = {
    textMatch: textMatchSignal(input.quiz, input.submissionText, input.transcript),
    policy: policySignal(input.quiz),
    comprehension: comprehensionSignal(input.comprehension),
  };
  const score = Math.min(
    100,
    Math.round(
      signals.textMatch.value * WEIGHTS.textMatch +
        signals.policy.value * WEIGHTS.policy +
        signals.comprehension.value * WEIGHTS.comprehension
    )
  );
  // Any single signal at its maximum also sends the submission to review, so
  // one clear issue is never hidden just because the others are quiet.
  const anyMaxed = Object.values(signals).some((s) => s.value >= 1);
  return {
    version: SCORING_VERSION,
    score,
    needsReview: score >= REVIEW_THRESHOLD || anyMaxed,
    signals,
  };
}
