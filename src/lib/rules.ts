// Plain-language AI rules for one assignment, written from the class syllabus
// and the assignment's instructions. Students read this before they start;
// teachers see the gaps (questions the policy doesn't answer) so they can fix
// the wording before anyone is flagged over an ambiguity.

import type Anthropic from "@anthropic-ai/sdk";
import { callClaude, MODELS } from "./ai";

import { CARD_USES, type CardUse, type UseStance, type RulesMode } from "./rules-shared";
export { CARD_USES, type CardUse, type UseStance, type RulesMode };

export type RulesCard = {
  // An explicit answer for each common use. Older cards may not have it.
  uses?: Partial<Record<CardUse, UseStance>>;
  allowed: string[]; // short lines, e.g. "Brainstorming topics with AI"
  notAllowed: string[];
  disclose: string; // how to disclose AI use; "" if the syllabus says nothing
  gaps: string[]; // for the teacher only: what the policy leaves unclear
  generatedAt: string;
  // Set when the teacher has reviewed and saved the rules. Their answers
  // override the syllabus wording in the analysis.
  confirmedByTeacher?: boolean;
  confirmedAt?: string;
  // Which option the teacher picked; absent means "same as syllabus".
  mode?: RulesMode;
  // The card as read from the syllabus, kept so "same as syllabus" can
  // restore it after a teacher picked another option.
  fromSyllabus?: Pick<RulesCard, "uses" | "allowed" | "notAllowed" | "disclose" | "gaps" | "generatedAt">;
};

const syllabusPart = (c: RulesCard) => ({
  uses: c.uses,
  allowed: c.allowed,
  notAllowed: c.notAllowed,
  disclose: c.disclose,
  gaps: c.gaps,
  generatedAt: c.generatedAt,
});

/** The syllabus reading of a card, whatever the teacher picked since. */
export function syllabusReading(card: RulesCard | null): RulesCard | null {
  if (!card) return null;
  if (card.fromSyllabus) return { ...card.fromSyllabus };
  if (!card.mode || card.mode === "syllabus") return { ...syllabusPart(card) };
  return null;
}

/** "Same as syllabus" or "No AI use allowed". */
export function applyRulesMode(card: RulesCard | null, mode: "syllabus" | "no_ai"): RulesCard | null {
  const base = syllabusReading(card);
  const now = new Date().toISOString();
  if (mode === "syllabus") {
    return base ? { ...base, mode: "syllabus", fromSyllabus: syllabusPart(base), confirmedByTeacher: true, confirmedAt: now } : null;
  }
  const uses: Partial<Record<CardUse, UseStance>> = {};
  for (const { key } of CARD_USES) uses[key] = key === "code" && base?.uses?.code === "n/a" ? "n/a" : "not_allowed";
  return {
    uses,
    allowed: [],
    notAllowed: ["Any use of AI tools on this assignment"],
    disclose: "",
    gaps: [],
    generatedAt: base?.generatedAt ?? now,
    mode: "no_ai",
    fromSyllabus: base ? syllabusPart(base) : undefined,
    confirmedByTeacher: true,
    confirmedAt: now,
  };
}

const SYSTEM_PROMPT = `You turn a course's AI-use policy into a short rules card a student can read in 20 seconds before starting one assignment.

Use only what the syllabus and assignment instructions actually say. Never invent a rule. If the policy is silent on something, do not guess; list it under gaps instead.

- uses: give an explicit answer for EACH of these six uses on this assignment:
  brainstorm (ideas, topics, outlines, counterarguments), grammar (an AI tool fixing grammar or spelling in the student's own text), paraphrase (AI rewording or polishing sentences the student wrote), draft (submitting sentences or paragraphs an AI wrote), research (AI explaining concepts, looking up facts, finding sources), code (AI writing or fixing code).
  Answer allowed, with_disclosure, not_allowed, unclear, or n/a (only for code when the assignment involves no code).
  How to read policies:
  * A blanket ban ("no AI in this course", "any use of AI is prohibited", "AI may not be used on any assignment") covers EVERY use, including grammar help and research. Answer not_allowed for all six unless the policy carves out an exception. A default ban that applies when the assignment doesn't grant permission also means not_allowed.
  * "grammar" means grammar help from an AI tool (a chatbot, or AI features like GrammarlyGO). Basic spell-check and grammar checkers (Word, Google Docs, PaperRater, SpellCheckPlus) are NOT AI. If a policy allows those basic tools but restricts generative AI, answer grammar not_allowed and put the basic tools in the allowed list instead.
  * A rule against one kind of AI use does not ban uses it doesn't mention. "Don't use AI to complete assignments / write your answers / generate code or proofs" bans draft (and code), but says nothing about brainstorming, research, or rewording: those are unclear and go in gaps. Only a ban on AI as a whole covers every use.
  * "Don't present AI work as your own", "the work must mainly be yours", or "purely AI work won't meet the standard" are NOT bans when the policy also lets students use AI text with credit or citation. Then draft is with_disclosure (or allowed if no disclosure is required).
  * A general disclosure rule ("cite any AI use", "acknowledge all AI use") turns every permitted use into with_disclosure.
  * Use unclear only when the policy genuinely doesn't settle the use, and then also list it under gaps.

- allowed: what students may use AI for on this assignment. Each line under 10 words, starting with a verb-ing or noun (e.g. "Brainstorming topics", "Checking grammar and spelling"). Max 5.
- notAllowed: what they may not use AI for. Same style. Max 5.
- disclose: one sentence (under 25 words) on whether and how to disclose AI use, in the policy's terms. Empty string if the policy says nothing about disclosure.
- gaps: for the TEACHER, not the student. Common student questions the policy does not answer and that would change whether a submission is flagged, e.g. "Doesn't say whether AI paraphrasing of the student's own draft is allowed." Each under 20 words. Max 4. Empty if the policy is clear.

Plain words, no legal tone, no restating the whole syllabus. Report with the submit_rules tool.`;

const TOOL: Anthropic.Tool = {
  name: "submit_rules",
  description: "Report the rules card.",
  input_schema: {
    type: "object",
    properties: {
      uses: {
        type: "object",
        properties: Object.fromEntries(
          ["brainstorm", "grammar", "paraphrase", "draft", "research", "code"].map((u) => [
            u,
            { type: "string", enum: ["allowed", "with_disclosure", "not_allowed", "unclear", "n/a"] },
          ])
        ),
        required: ["brainstorm", "grammar", "paraphrase", "draft", "research", "code"],
      },
      allowed: { type: "array", items: { type: "string" } },
      notAllowed: { type: "array", items: { type: "string" } },
      disclose: { type: "string" },
      gaps: { type: "array", items: { type: "string" } },
    },
    required: ["uses", "allowed", "notAllowed", "disclose", "gaps"],
  },
};

const strs = (v: unknown, max: number) =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x.trim() !== "").slice(0, max) : [];

export async function generateRulesCard(input: {
  syllabus: string;
  title: string;
  instructions: string;
}): Promise<RulesCard> {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("Server is missing ANTHROPIC_API_KEY.");
  const message = await callClaude("rules", {
    model: MODELS.fast,
    max_tokens: 1000,
    system: SYSTEM_PROMPT,
    tools: [TOOL],
    tool_choice: { type: "tool", name: "submit_rules" },
    messages: [
      {
        role: "user",
        content: `SYLLABUS:\n${input.syllabus}\n\n---\n\nASSIGNMENT: ${input.title}\n${input.instructions}`,
      },
    ],
  });
  const block = message.content.find((b) => b.type === "tool_use" && b.name === "submit_rules");
  if (!block || block.type !== "tool_use") throw new Error("Couldn't write the rules card. Try again.");
  const r = block.input as Record<string, unknown>;
  const STANCES = ["allowed", "with_disclosure", "not_allowed", "unclear", "n/a"];
  const rawUses = (r.uses ?? {}) as Record<string, unknown>;
  const uses: Partial<Record<CardUse, UseStance>> = {};
  for (const { key } of CARD_USES) {
    const v = rawUses[key];
    if (typeof v === "string" && STANCES.includes(v)) uses[key] = v as UseStance;
  }
  return {
    uses,
    allowed: strs(r.allowed, 5),
    notAllowed: strs(r.notAllowed, 5),
    disclose: typeof r.disclose === "string" ? r.disclose.trim() : "",
    gaps: strs(r.gaps, 4),
    generatedAt: new Date().toISOString(),
  };
}

/** The card students see: everything except the teacher-only gaps. */
export function rulesForStudent(card: RulesCard | null) {
  if (!card) return null;
  return { uses: card.uses, allowed: card.allowed, notAllowed: card.notAllowed, disclose: card.disclose };
}

/**
 * Returns the assignment's rules card, writing it first if it doesn't exist.
 * A failure returns null instead of throwing, so a page never breaks because
 * the card couldn't be written; it's retried on the next load.
 */
export async function ensureRulesCard(assignment: {
  id: number;
  classId: number;
  title: string;
  instructions: string;
  rulesCard?: unknown;
}): Promise<RulesCard | null> {
  const existing = assignment.rulesCard as RulesCard | null | undefined;
  // Cards written before the per-use grid existed are rewritten once.
  if (existing && ((existing.uses && Object.keys(existing.uses).length > 0) || existing.mode)) return existing;
  const { db } = await import("@/src/prisma/db");
  const { withAiContext } = await import("./ai");
  const cls = await db.orm.public.Class.where({ id: assignment.classId }).select("syllabusText").first();
  if (!cls) return null;
  try {
    const card = await withAiContext({ classId: assignment.classId }, () =>
      generateRulesCard({ syllabus: cls.syllabusText, title: assignment.title, instructions: assignment.instructions })
    );
    await db.orm.public.Assignment.where({ id: assignment.id }).update({ rulesCard: card });
    return card;
  } catch {
    return existing ?? null;
  }
}

/** Applies a teacher's edits: their per-use answers become the rules. */
export function confirmRules(
  card: RulesCard | null,
  edits: { uses: Partial<Record<CardUse, UseStance>>; disclose: string }
): RulesCard {
  const uses = { ...(card?.uses ?? {}), ...edits.uses };
  const label = (k: CardUse) => CARD_USES.find((u) => u.key === k)!.label;
  const keys = CARD_USES.map((u) => u.key).filter((k) => uses[k] && uses[k] !== "n/a");
  return {
    uses,
    allowed: keys.filter((k) => uses[k] === "allowed" || uses[k] === "with_disclosure").map(label),
    notAllowed: keys.filter((k) => uses[k] === "not_allowed").map(label),
    disclose: edits.disclose.trim(),
    // Questions the teacher left as "not sure" stay open; the rest are answered.
    gaps: keys.filter((k) => uses[k] === "unclear").map((k) => `${label(k)}: left as "not sure", so it's flagged for follow-up.`),
    generatedAt: card?.generatedAt ?? new Date().toISOString(),
    confirmedByTeacher: true,
    confirmedAt: new Date().toISOString(),
    mode: "custom",
    fromSyllabus: (() => {
      const b = syllabusReading(card);
      return b ? syllabusPart(b) : undefined;
    })(),
  };
}

/** The teacher's confirmed rules as text for the analysis prompt, or "". */
export function confirmedRulesText(card: RulesCard | null | undefined): string {
  // "Same as syllabus" leaves the syllabus as the authority.
  if (!card?.confirmedByTeacher || !card.uses || !card.mode || card.mode === "syllabus") return "";
  const lines = CARD_USES.filter((u) => card.uses![u.key] && card.uses![u.key] !== "n/a").map(
    (u) => `- ${u.label}: ${card.uses![u.key] === "unclear" ? "not decided (treat as needing a follow-up, not a violation)" : card.uses![u.key]!.replace("_", " ")}`
  );
  if (card.mode === "no_ai") {
    return `\n\n---\n\nTEACHER'S RULE FOR THIS ASSIGNMENT (overrides the syllabus): No AI use of any kind is allowed on this assignment.`;
  }
  return `\n\n---\n\nTEACHER-CONFIRMED AI RULES FOR THIS ASSIGNMENT (these override the syllabus wording where they differ):\n${lines.join("\n")}${card.disclose ? `\n- How to disclose: ${card.disclose}` : ""}`;
}
