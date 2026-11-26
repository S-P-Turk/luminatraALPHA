// Rules-card check: write the card the way the app does, have a separate,
// narrowly-prompted call read ONLY the card and say what it permits for six
// uses, then compare with hand labels. Used by the admin test lab button and
// scripts/eval/eval-rules.ts.

import type Anthropic from "@anthropic-ai/sdk";
import { callClaude, withAiContext } from "../ai";
import { generateRulesCard, type RulesCard } from "../rules";
import { USES, type PolicyCase, type Stance, type Use } from "./policies";

export const STANCES: Stance[] = ["allowed", "with_disclosure", "not_allowed", "unclear"];
export type Grade = "match" | "near" | "soft" | "strict" | "lenient";

const TOOL: Anthropic.Tool = {
  name: "submit_stances",
  description: "Report what the text permits for each use.",
  input_schema: {
    type: "object",
    properties: Object.fromEntries(USES.map((u) => [u, { type: "string", enum: STANCES }])),
    required: USES,
  },
};

const USE_TEXT: Record<Use, string> = {
  brainstorm: "brainstorm: using AI to generate ideas, topics, outlines or counterarguments",
  grammar: "grammar: using an AI chatbot to fix grammar or spelling in the student's own text",
  paraphrase: "paraphrase: using AI to reword or polish sentences the student wrote",
  draft: "draft: submitting text (sentences or paragraphs) that an AI wrote",
  research: "research: using AI to explain concepts, look up facts or find sources",
  code: "code: using AI to write or fix code",
};

export async function stancesFrom(label: string, text: string): Promise<Record<Use, Stance>> {
  const msg = await callClaude("eval", {
    model: "claude-sonnet-5",
    max_tokens: 300,
    system: `Read the ${label} and report, for each use below, what it permits: allowed (no conditions), with_disclosure (allowed if disclosed/cited), not_allowed, or unclear (the text doesn't settle it, or lists it as an open question). Judge only from the text; do not apply common sense about what a teacher probably means.\n\n${USES.map((u) => USE_TEXT[u]).join("\n")}`,
    tools: [TOOL],
    tool_choice: { type: "tool", name: "submit_stances" },
    messages: [{ role: "user", content: text }],
  });
  const block = msg.content.find((b) => b.type === "tool_use");
  if (!block || block.type !== "tool_use") throw new Error("no stances returned");
  return block.input as Record<Use, Stance>;
}

export const cardText = (c: RulesCard) =>
  `ALLOWED:\n${c.allowed.map((x) => `- ${x}`).join("\n") || "(none listed)"}\n\nNOT ALLOWED:\n${c.notAllowed.map((x) => `- ${x}`).join("\n") || "(none listed)"}\n\nDISCLOSURE: ${c.disclose || "(not mentioned)"}\n\nOPEN QUESTIONS THE POLICY DOESN'T ANSWER:\n${c.gaps.map((x) => `- ${x}`).join("\n") || "(none)"}`;

// with_disclosure vs allowed is a near miss; anything vs unclear is a soft miss.
export function grade(expected: Stance, got: Stance): Grade {
  if (expected === got) return "match";
  const rank = { allowed: 0, with_disclosure: 1, not_allowed: 2 } as const;
  if (expected === "unclear" || got === "unclear") return "soft";
  if (Math.abs(rank[expected] - rank[got]) === 1 && expected !== "not_allowed" && got !== "not_allowed") return "near";
  return rank[got] > rank[expected] ? "strict" : "lenient";
}

export type RulesCheckResult = {
  id: string;
  card: RulesCard;
  got: Record<Use, Stance>;
  misses: { use: Use; expected: Stance; got: Stance; grade: Grade }[];
  tally: Record<Grade, number>;
};

export async function checkPolicy(p: PolicyCase): Promise<RulesCheckResult> {
  return withAiContext({ step: "eval" }, async () => {
    const card = await generateRulesCard({ syllabus: p.policy, title: p.assignment.title, instructions: p.assignment.instructions });
    const got = await stancesFrom("rules card", cardText(card));
    const tally: Record<Grade, number> = { match: 0, near: 0, soft: 0, strict: 0, lenient: 0 };
    const misses: RulesCheckResult["misses"] = [];
    for (const [use, exp] of Object.entries(p.expected) as [Use, Stance][]) {
      const g = grade(exp, got[use]);
      tally[g]++;
      if (g !== "match") misses.push({ use, expected: exp, got: got[use], grade: g });
    }
    return { id: p.id, card, got, misses, tally };
  });
}
