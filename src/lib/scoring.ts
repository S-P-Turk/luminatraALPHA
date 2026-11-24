// Luminatra's scoring layer: turns the three signals into a 0–100
// "follow-up priority". The AI only *proposes* evidence (passages, severity,
// answer adequacy); this file decides what counts and how much, using fixed,
// documented rules, so every score can be explained line by line.
//
// It is never a probability of cheating. It ranks which submissions a teacher
// may want to look at first.

import type { QuizResult, ComprehensionResult } from "./quiz";
import { buildContributionMap, type ContributionMap } from "./contribution";

// v2: contribution map (copied / paraphrased / AI-assisted) replaces the
// v1 copy-only text match.
export const SCORING_VERSION = "v2";

export const WEIGHTS = { textMatch: 45, policy: 30, comprehension: 25 } as const;

// Submissions at or above this score go to "Needs review".
export const REVIEW_THRESHOLD = 40;

// Share of the submission that, if AI-written and presented as the student's
// own, maxes out the text-match signal.
const TEXT_MATCH_FULL_SHARE = 0.3;


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
  contribution: ContributionMap;
};

// ---------------------------------------------------------------------------
// Individual signals

// Paraphrased-without-disclosure counts half as much as a near-exact copy:
// it's real evidence, but recognizing a paraphrase is a judgment call.
const PARAPHRASE_WEIGHT = 0.5;

function textMatchSignal(map: ContributionMap, analyzed: boolean): Signal {
  const max = WEIGHTS.textMatch;
  if (!analyzed) {
    return { value: 0, points: 0, max, reason: "Not checked (analyzed before text matching existed)." };
  }
  if (map.totalWords === 0) return { value: 0, points: 0, max, reason: "" };
  const share = Math.min(1, (map.words.copied + PARAPHRASE_WEIGHT * map.words.paraphrased) / map.totalWords);
  const value = Math.min(1, share / TEXT_MATCH_FULL_SHARE);
  const parts: string[] = [];
  if (map.words.copied > 0) parts.push(`${Math.max(1, map.percent.copied)}% copied from AI`);
  if (map.words.paraphrased > 0) parts.push(`${Math.max(1, map.percent.paraphrased)}% closely paraphrased from AI`);
  const reason = parts.length ? `${parts.join(" and ")}, not disclosed.` : "";
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
  const contribution = buildContributionMap({
    submission: input.submissionText,
    transcript: input.transcript,
    passages: input.quiz.ai_passages,
    summary: input.quiz.usage_summary,
  });
  const signals = {
    textMatch: textMatchSignal(contribution, input.quiz.ai_passages !== undefined),
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
    contribution,
  };
}
