// Plain-language AI rules for one assignment, written from the class syllabus
// and the assignment's instructions. Students read this before they start;
// teachers see the gaps (questions the policy doesn't answer) so they can fix
// the wording before anyone is flagged over an ambiguity.

import type Anthropic from "@anthropic-ai/sdk";
import { callClaude } from "./ai";

export type RulesCard = {
  allowed: string[]; // short lines, e.g. "Brainstorming topics with AI"
  notAllowed: string[];
  disclose: string; // how to disclose AI use; "" if the syllabus says nothing
  gaps: string[]; // for the teacher only: what the policy leaves unclear
  generatedAt: string;
};

const SYSTEM_PROMPT = `You turn a course's AI-use policy into a short rules card a student can read in 20 seconds before starting one assignment.

Use only what the syllabus and assignment instructions actually say. Never invent a rule. If the policy is silent on something, do not guess; list it under gaps instead.

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
      allowed: { type: "array", items: { type: "string" } },
      notAllowed: { type: "array", items: { type: "string" } },
      disclose: { type: "string" },
      gaps: { type: "array", items: { type: "string" } },
    },
    required: ["allowed", "notAllowed", "disclose", "gaps"],
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
    model: "claude-sonnet-5",
    max_tokens: 800,
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
  return {
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
  return { allowed: card.allowed, notAllowed: card.notAllowed, disclose: card.disclose };
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
  if (assignment.rulesCard) return assignment.rulesCard as RulesCard;
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
    return null;
  }
}
