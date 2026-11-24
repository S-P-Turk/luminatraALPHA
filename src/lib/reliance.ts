// AI reliance: how much of a submission's substance came from AI — ideas as
// well as wording — rated paragraph by paragraph.
//
// The analyzer proposes a rating per paragraph with the AI reply it came
// from. This code decides what counts:
//   - a rating only stands if its cited source really is in the AI's side of
//     the transcript, or the paragraph contains verified copied/paraphrased
//     AI text (from the contribution map);
//   - verified copied text sets a floor the analyzer can't go under, so a
//     mostly-copied paragraph is "written by AI" even if the analyzer
//     under-rates it;
//   - reliance is the word-weighted average over the whole submission.

import type { ParagraphReliance } from "./quiz";
import { aiTurns, tokenize, type ContributionMap } from "./contribution";
import { splitParagraphs } from "./paragraphs";

export type RelianceLevel = "none" | "ideas" | "heavy" | "written";

export const LEVEL_WEIGHT: Record<RelianceLevel, number> = { none: 0, ideas: 0.35, heavy: 0.7, written: 1 };
const RANK: Record<RelianceLevel, number> = { none: 0, ideas: 1, heavy: 2, written: 3 };

export type ParagraphResult = {
  index: number;
  start: number;
  end: number;
  words: number;
  level: RelianceLevel;
  disclosed: boolean;
  note: string;
  source: string | null;
  evidence: "source" | "copied-text" | "none";
  keywordShare?: number; // measured overlap with the cited AI source
  phraseShare?: number;
  adjustedFrom?: RelianceLevel; // the analyzer's label, if the measurement capped it
};

export type RelianceResult = {
  reliance: number; // 0..1, undisclosed only — this is what's scored
  disclosedReliance: number; // 0..1, shown but not scored
  percent: Record<RelianceLevel | "disclosed", number>; // share of words by level
  paragraphs: ParagraphResult[];
  rejected: number;
  legacy: boolean; // no per-paragraph ratings; floors from copied text only
};

function ngrams(ws: string[], n: number): Set<string> {
  const out = new Set<string>();
  for (let i = 0; i + n <= ws.length; i++) out.add(ws.slice(i, i + n).join(" "));
  return out;
}

function sourceVerified(excerpt: string, aiGrams: Set<string>): boolean {
  const ws = tokenize(excerpt).map((t) => t.word);
  if (ws.length < 5) return false;
  const own = ngrams(ws, 5);
  let hit = 0;
  for (const g of own) if (aiGrams.has(g)) hit++;
  return own.size > 0 && hit / own.size >= 0.8;
}

// Light stemming so "signed"/"signing" or "damage"/"damaged" still match.
const STOP = new Set(
  "about after also because been being both could does doing from have having into just more most much only other over said same should some such than that their them then there these they this those through very what when where which while will with would your".split(" ")
);
function stems(text: string): Set<string> {
  return new Set(
    tokenize(text)
      .map((t) => t.word.replace(/'s$/, ""))
      .filter((w) => w.length > 3 && !STOP.has(w))
      .map((w) => w.slice(0, 5))
  );
}

/**
 * The cited AI reply must actually relate to the paragraph: at least 3
 * shared content words, or 20% of the reply's content words. Otherwise a
 * real-but-unrelated AI reply (e.g. a brainstorm list) could be used to
 * label an honest paragraph as AI-dependent.
 */
export function relatedToParagraph(source: string, paragraph: string): boolean {
  const a = stems(source);
  const b = stems(paragraph);
  let shared = 0;
  for (const w of a) if (b.has(w)) shared++;
  return shared >= 3 || (a.size > 0 && shared / a.size >= 0.2);
}

// Measured lines between levels, calibrated on the test set (Nov 24):
//   "ideas" paragraphs share 27–37% of their key words with the AI source
//   and no 3-word phrases; "heavy" 76–87% key words, 37–61% phrases;
//   "written" ~100% of both. The analyzer's label is capped by what the
//   measurement supports, so every label is explainable with a number.
export const HEAVY_MIN_KEYWORD_SHARE = 0.55;
export const WRITTEN_MIN_PHRASE_SHARE = 0.75;

/** Share of the paragraph's key words (stems) that appear in the source. */
export function keywordShare(paragraph: string, source: string): number {
  const a = stems(paragraph);
  const b = stems(source);
  let hit = 0;
  for (const w of a) if (b.has(w)) hit++;
  return a.size ? hit / a.size : 0;
}

/** Share of the paragraph's 3-word phrases that appear verbatim in the source. */
export function phraseShare(paragraph: string, source: string): number {
  const p = tokenize(paragraph).map((t) => t.word);
  const src = ngrams(tokenize(source).map((t) => t.word), 3);
  let hit = 0;
  let total = 0;
  for (let i = 0; i + 3 <= p.length; i++) {
    total++;
    if (src.has(p.slice(i, i + 3).join(" "))) hit++;
  }
  return total ? hit / total : 0;
}

/** The highest level the measured overlap with the cited source supports. */
export function supportedLevel(claimed: RelianceLevel, paragraph: string, source: string): RelianceLevel {
  let level = claimed;
  if (level === "written" && phraseShare(paragraph, source) < WRITTEN_MIN_PHRASE_SHARE) level = "heavy";
  if (level === "heavy" && keywordShare(paragraph, source) < HEAVY_MIN_KEYWORD_SHARE) level = "ideas";
  return level;
}

const maxLevel = (a: RelianceLevel, b: RelianceLevel) => (RANK[a] >= RANK[b] ? a : b);

export function computeReliance(input: {
  submission: string;
  transcript: string;
  ratings: ParagraphReliance[] | undefined;
  contribution: ContributionMap;
}): RelianceResult {
  const paras = splitParagraphs(input.submission);
  const tokens = tokenize(input.submission);
  const aiText = aiTurns(input.transcript) ?? input.transcript;
  const aiGrams = ngrams(tokenize(aiText).map((t) => t.word), 5);

  // Undisclosed copied/paraphrased words per paragraph, from the verified map.
  const segs = input.contribution.segments.filter((s) => s.kind === "copied" || s.kind === "paraphrased");
  const kindAt = (pos: number) => segs.find((s) => pos >= s.start && pos < s.end)?.kind;

  let rejected = 0;
  const results: ParagraphResult[] = paras.map((p) => {
    const ptoks = tokens.filter((t) => t.start >= p.start && t.end <= p.end);
    const words = ptoks.length;
    let copied = 0;
    let paraphrased = 0;
    for (const t of ptoks) {
      const k = kindAt(t.start);
      if (k === "copied") copied++;
      else if (k === "paraphrased") paraphrased++;
    }
    const share = words ? copied / words : 0;
    const shareAny = words ? (copied + paraphrased) / words : 0;
    const floor: RelianceLevel = share >= 0.6 ? "written" : shareAny >= 0.3 ? "heavy" : shareAny > 0 ? "ideas" : "none";

    const rating = input.ratings?.find((r) => r.index === p.index);
    let level: RelianceLevel = "none";
    let disclosed = false;
    let note = "";
    let source: string | null = null;
    let evidence: ParagraphResult["evidence"] = "none";
    let kShare: number | undefined;
    let pShare: number | undefined;
    let adjustedFrom: RelianceLevel | undefined;

    if (rating && rating.reliance !== "none") {
      const verified =
        rating.ai_source_excerpt
          ? sourceVerified(rating.ai_source_excerpt, aiGrams) && relatedToParagraph(rating.ai_source_excerpt, p.text)
          : false;
      if (verified) {
        // Cap the analyzer's label at what the measured overlap supports.
        level = supportedLevel(rating.reliance, p.text, rating.ai_source_excerpt);
        if (level !== rating.reliance) adjustedFrom = rating.reliance;
        kShare = keywordShare(p.text, rating.ai_source_excerpt);
        pShare = phraseShare(p.text, rating.ai_source_excerpt);
        disclosed = rating.disclosed;
        note = rating.note;
        source = rating.ai_source_excerpt;
        evidence = "source";
      } else if (floor !== "none") {
        // No usable source quote: only the verified copied text counts.
        level = floor;
        disclosed = rating.disclosed;
        note = rating.note;
        evidence = "copied-text";
      } else {
        rejected++; // a rating with no real AI source behind it doesn't count
      }
    }

    // Mechanical evidence of undisclosed copying can't be rated away.
    if (RANK[floor] > RANK[level] || (floor !== "none" && disclosed)) {
      level = maxLevel(level, floor);
      disclosed = false;
      if (evidence === "none") evidence = "copied-text";
      if (!note) note = floor === "written" ? "Mostly copied from an AI reply." : "Closely follows AI-written text.";
    }

    return {
      index: p.index,
      start: p.start,
      end: p.end,
      words,
      level,
      disclosed,
      note,
      source,
      evidence,
      keywordShare: kShare,
      phraseShare: pShare,
      adjustedFrom,
    };
  });

  const total = results.reduce((n, p) => n + p.words, 0) || 1;
  let reliance = 0;
  let disclosedReliance = 0;
  const byLevel = { none: 0, ideas: 0, heavy: 0, written: 0, disclosed: 0 };
  for (const p of results) {
    const w = LEVEL_WEIGHT[p.level] * p.words;
    if (p.level !== "none" && p.disclosed) {
      disclosedReliance += w;
      byLevel.disclosed += p.words;
    } else {
      reliance += w;
      byLevel[p.level] += p.words;
    }
  }
  const pct = (n: number) => Math.round((100 * n) / total);

  return {
    reliance: reliance / total,
    disclosedReliance: disclosedReliance / total,
    percent: {
      none: pct(byLevel.none),
      ideas: pct(byLevel.ideas),
      heavy: pct(byLevel.heavy),
      written: pct(byLevel.written),
      disclosed: pct(byLevel.disclosed),
    },
    paragraphs: results,
    rejected,
    legacy: input.ratings === undefined,
  };
}
