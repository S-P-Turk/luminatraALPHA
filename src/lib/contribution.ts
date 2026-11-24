// AI contribution map: which parts of a submission the student wrote, which
// came from AI with disclosure (or were only polished by AI), and which were
// copied or closely paraphrased from AI without disclosure.
//
// The analyzer only PROPOSES passages. Everything here is deterministic code:
// a passage counts only if it really appears in the submission and its source
// really appears in the transcript, and word counts come from the submission
// itself, so overlapping or duplicated proposals can't inflate anything.

import type { AiPassage } from "./quiz";

export type ContributionKind = "copied" | "paraphrased" | "assisted";

export type ContributionSource = {
  kind: "verbatim" | "paraphrased" | "edited";
  disclosed: boolean;
  transcriptExcerpt: string | null;
};

export type ContributionSegment = {
  start: number; // character offsets into the submission text
  end: number;
  kind: ContributionKind;
  source: number; // index into sources
};

export type ContributionMap = {
  totalWords: number;
  words: Record<ContributionKind | "student", number>;
  percent: Record<ContributionKind | "student", number>;
  segments: ContributionSegment[];
  sources: ContributionSource[];
  summary: string;
  rejected: number; // proposals that failed verification
  legacy: boolean; // analyzed before the contribution map existed
  speakersDetected: boolean; // sources checked against AI turns only
};

// ---------------------------------------------------------------------------
// Tokenizing with character offsets

type Token = { word: string; start: number; end: number };

const WORD_RE = /[A-Za-z0-9]+(?:['’][A-Za-z0-9]+)*/g;

export function tokenize(text: string): Token[] {
  const out: Token[] = [];
  for (const m of text.matchAll(WORD_RE)) {
    out.push({ word: m[0].toLowerCase().replace(/’/g, "'"), start: m.index!, end: m.index! + m[0].length });
  }
  return out;
}

const words = (text: string) => tokenize(text).map((t) => t.word);

function ngrams(ws: string[], n: number): Set<string> {
  const out = new Set<string>();
  for (let i = 0; i + n <= ws.length; i++) out.add(ws.slice(i, i + n).join(" "));
  return out;
}

const STOP = new Set(
  "a an and are as at be been but by for from has have he her his i if in into is it its of on or our she so that the their them then there these they this to was we were what when which who will with would you your not no can could should may might also than very more most such".split(
    " "
  )
);

function contentWords(ws: string[]): Set<string> {
  return new Set(ws.filter((w) => w.length > 2 && !STOP.has(w)));
}

// Share of the excerpt's n-word runs found in a target's n-gram set.
function ngramCoverage(excerpt: string[], target: Set<string>, n: number): number {
  const own = ngrams(excerpt, n);
  if (own.size === 0) return 0;
  let hit = 0;
  for (const g of own) if (target.has(g)) hit++;
  return hit / own.size;
}

/**
 * Word indices of the submission covered by an excerpt, found by matching
 * the excerpt's n-word runs against the submission. Robust to small edits
 * at the edges; returns [] if the excerpt isn't really in the submission.
 */
function locate(excerpt: string[], sub: string[], n: number): number[] {
  if (excerpt.length < n) return [];
  const own = ngrams(excerpt, n);
  const covered = new Set<number>();
  let hits = 0;
  for (let i = 0; i + n <= sub.length; i++) {
    if (own.has(sub.slice(i, i + n).join(" "))) {
      hits++;
      for (let k = i; k < i + n; k++) covered.add(k);
    }
  }
  // Require most of the excerpt to be present, or it's not a real quote.
  if (hits / Math.max(1, excerpt.length - n + 1) < 0.6) return [];
  return [...covered].sort((a, b) => a - b);
}

// ---------------------------------------------------------------------------
// Speaker detection: when the transcript labels who's talking, only the AI's
// turns count as sources, so a student's own draft pasted into the chat can
// never be mistaken for AI writing.

const USER_LABEL = /^\s*(?:\*\*)?(?:user|you|you said|me|student|human|prompt|q)(?:\*\*)?\s*[:：]/i;
const AI_LABEL =
  /^\s*(?:\*\*)?(?:assistant|ai|chatgpt|chatgpt said|claude|claude said|gemini|copilot|bard|bot|model|gpt[-\w.]*|response|a)(?:\*\*)?\s*[:：]/i;

/** The AI's side of the conversation, or null if speakers aren't labeled. */
export function aiTurns(transcript: string): string | null {
  const lines = transcript.split(/\r?\n/);
  let speaker: "user" | "ai" | null = null;
  let sawUser = false;
  let sawAi = false;
  const ai: string[] = [];
  for (const line of lines) {
    if (USER_LABEL.test(line)) {
      speaker = "user";
      sawUser = true;
      continue;
    }
    if (AI_LABEL.test(line)) {
      speaker = "ai";
      sawAi = true;
      ai.push(line.replace(AI_LABEL, ""));
      continue;
    }
    if (speaker === "ai") ai.push(line);
  }
  return sawUser && sawAi ? ai.join("\n") : null;
}

const MIN_WORDS = 8;
const PRIORITY: Record<ContributionKind, number> = { copied: 3, paraphrased: 2, assisted: 1 };

function classify(p: AiPassage): { kind: ContributionKind; srcKind: ContributionSource["kind"] } {
  const srcKind = p.kind ?? "verbatim"; // older analyses only flagged near-copies
  if (srcKind === "edited") return { kind: "assisted", srcKind };
  if (!p.claimed_as_own) return { kind: "assisted", srcKind }; // disclosed
  return { kind: srcKind === "paraphrased" ? "paraphrased" : "copied", srcKind };
}

export function buildContributionMap(input: {
  submission: string;
  transcript: string;
  passages: AiPassage[] | undefined;
  summary?: string;
}): ContributionMap {
  const tokens = tokenize(input.submission);
  const sub = tokens.map((t) => t.word);
  // Prefer the AI's turns only; fall back to the whole transcript when the
  // speakers aren't labeled.
  const aiText = aiTurns(input.transcript);
  const tr = words(aiText ?? input.transcript);
  const trGrams8 = ngrams(tr, 8);
  const trGrams5 = ngrams(tr, 5);

  const owner: (number | null)[] = new Array(sub.length).fill(null); // source index per word
  const ownerKind: (ContributionKind | null)[] = new Array(sub.length).fill(null);
  const sources: ContributionSource[] = [];
  let rejected = 0;

  for (const p of input.passages ?? []) {
    const ex = words(p.submission_excerpt);
    if (ex.length < MIN_WORDS) {
      rejected++;
      continue;
    }
    const { kind, srcKind } = classify(p);
    const src = p.transcript_excerpt ? words(p.transcript_excerpt) : null;

    // 1. The passage must really be in the submission.
    const where = locate(ex, sub, 5);
    if (where.length === 0) {
      rejected++;
      continue;
    }

    // 2. Its source must really be in the transcript, and actually resemble it.
    let ok: boolean;
    if (srcKind === "verbatim" || !src) {
      // Near-copies: the submission text itself must appear in the transcript.
      ok = ngramCoverage(ex, trGrams8, 8) >= 0.8 || (ex.length < 12 && ngramCoverage(ex, trGrams5, 5) >= 0.8);
    } else {
      const srcInTranscript = src.length >= 5 && ngramCoverage(src, trGrams5, 5) >= 0.8;
      const a = contentWords(ex);
      const b = contentWords(src);
      const shared = [...a].filter((w) => b.has(w)).length;
      const overlap = shared / Math.max(1, Math.min(a.size, b.size));
      ok = srcInTranscript && overlap >= 0.35;
    }
    if (!ok) {
      rejected++;
      continue;
    }

    const idx = sources.push({
      kind: srcKind,
      disclosed: !p.claimed_as_own,
      transcriptExcerpt: p.transcript_excerpt ?? null,
    }) - 1;
    // Where proposals overlap, the more serious category wins.
    for (const w of where) {
      if (!ownerKind[w] || PRIORITY[kind] > PRIORITY[ownerKind[w]!]) {
        ownerKind[w] = kind;
        owner[w] = idx;
      }
    }
  }

  const count = { student: 0, copied: 0, paraphrased: 0, assisted: 0 };
  for (const k of ownerKind) count[k ?? "student"]++;
  const total = sub.length;
  const pct = (n: number) => (total ? Math.round((100 * n) / total) : 0);

  // Merge consecutive words with the same category and source into spans.
  const segments: ContributionSegment[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const k = ownerKind[i];
    if (!k) continue;
    const last = segments[segments.length - 1];
    if (last && last.kind === k && last.source === owner[i] && i > 0 && ownerKind[i - 1] === k && owner[i - 1] === owner[i]) {
      last.end = tokens[i].end;
    } else {
      segments.push({ start: tokens[i].start, end: tokens[i].end, kind: k, source: owner[i]! });
    }
  }

  return {
    totalWords: total,
    words: count,
    percent: {
      student: pct(count.student),
      copied: pct(count.copied),
      paraphrased: pct(count.paraphrased),
      assisted: pct(count.assisted),
    },
    segments,
    sources,
    summary: input.summary?.trim() || "",
    rejected,
    legacy: (input.passages ?? []).length > 0 && (input.passages ?? []).every((p) => !p.kind),
    speakersDetected: aiText !== null,
  };
}
