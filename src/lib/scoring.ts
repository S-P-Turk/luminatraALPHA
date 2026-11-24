// Luminatra's scoring layer: turns the three signals into a 0–100
// "follow-up priority". The AI only *proposes* evidence (passages, severity,
// answer adequacy); this file decides what counts and how much, using fixed,
// documented rules, so every score can be explained line by line.
//
// It is never a probability of cheating. It ranks which submissions a teacher
// may want to look at first.

import type { QuizResult, ComprehensionResult } from "./quiz";
import { buildContributionMap, type ContributionMap } from "./contribution";
import { computeReliance, type RelianceResult } from "./reliance";

// v2: contribution map (copied / paraphrased / AI-assisted).
// v3: AI reliance (ideas + wording, per paragraph) replaces copied-text share;
//     comprehension becomes the heaviest signal.
// v3.1: reliance labels capped by measured overlap with the AI source.
export const SCORING_VERSION = "v3.1";

export const WEIGHTS = { comprehension: 45, reliance: 30, policy: 25 } as const;

// Submissions at or above this score go to "Needs review".
export const REVIEW_THRESHOLD = 40;

// Undisclosed AI reliance at which the reliance signal maxes out: e.g. half
// the submission written by AI, or most of it built on AI ideas and wording.
const RELIANCE_FULL = 0.5;


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
  reliance: RelianceResult;
};

// ---------------------------------------------------------------------------
// Individual signals

const LEVEL_PHRASE = { ideas: "built on AI ideas", heavy: "closely follows AI", written: "written by AI" } as const;

function relianceSignal(rel: RelianceResult, analyzed: boolean): Signal {
  const max = WEIGHTS.reliance;
  if (!analyzed) {
    return { value: 0, points: 0, max, reason: "Not checked (analyzed before AI text checks existed)." };
  }
  const value = Math.min(1, rel.reliance / RELIANCE_FULL);
  const flagged = rel.paragraphs.filter((p) => p.level !== "none" && !p.disclosed);
  let reason = "";
  if (flagged.length) {
    const list = flagged
      .slice(0, 3)
      .map((p) => `¶${p.index} ${LEVEL_PHRASE[p.level as keyof typeof LEVEL_PHRASE]}`)
      .join(", ");
    reason = `AI reliance ${Math.max(1, Math.round(rel.reliance * 100))}%: ${list}${flagged.length > 3 ? ", …" : ""} — not disclosed.`;
  }
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
  const reliance = computeReliance({
    submission: input.submissionText,
    transcript: input.transcript,
    ratings: input.quiz.paragraphs,
    contribution,
  });
  const signals = {
    reliance: relianceSignal(reliance, input.quiz.ai_passages !== undefined || input.quiz.paragraphs !== undefined),
    policy: policySignal(input.quiz),
    comprehension: comprehensionSignal(input.comprehension),
  };
  const score = Math.min(
    100,
    Math.round(
      signals.reliance.value * WEIGHTS.reliance +
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
    reliance,
  };
}
