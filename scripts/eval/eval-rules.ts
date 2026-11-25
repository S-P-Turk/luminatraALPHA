// Checks how well the rules cards read real-world AI policies.
//
// For each labeled policy: write the rules card exactly as the app does, then
// have a separate, narrowly-prompted Claude call read ONLY the card and say
// what it permits for six common uses. Compare with the hand labels.
//
//   ANTHROPIC_API_KEY=sk-... npx tsx scripts/eval/eval-rules.ts            # all labeled
//   ANTHROPIC_API_KEY=sk-... npx tsx scripts/eval/eval-rules.ts pol-cs     # id prefix
//   ANTHROPIC_API_KEY=sk-... npx tsx scripts/eval/eval-rules.ts --propose  # suggest labels for imported policies
//
// The two errors that matter most:
//   strict  - the card forbids something the policy allows (students get
//             wrongly scared off, teachers get false flags)
//   lenient - the card allows something the policy forbids (the rule the
//             teacher cares about never reaches the student)

import { readFileSync, writeFileSync } from "node:fs";
import type Anthropic from "@anthropic-ai/sdk";
import { callClaude } from "../../src/lib/ai";
import { generateRulesCard, type RulesCard } from "../../src/lib/rules";
import { POLICY_CASES, USES, type PolicyCase, type Stance, type Use } from "../../src/lib/eval/policies";

const IMPORTED = "src/lib/eval/policies-imported.json";
const STANCES: Stance[] = ["allowed", "with_disclosure", "not_allowed", "unclear"];

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

async function stancesFrom(label: string, text: string): Promise<Record<Use, Stance>> {
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

const cardText = (c: RulesCard) =>
  `ALLOWED:\n${c.allowed.map((x) => `- ${x}`).join("\n") || "(none listed)"}\n\nNOT ALLOWED:\n${c.notAllowed.map((x) => `- ${x}`).join("\n") || "(none listed)"}\n\nDISCLOSURE: ${c.disclose || "(not mentioned)"}\n\nOPEN QUESTIONS THE POLICY DOESN'T ANSWER:\n${c.gaps.map((x) => `- ${x}`).join("\n") || "(none)"}`;

// with_disclosure vs allowed is a near miss; anything vs unclear is a soft miss.
function grade(expected: Stance, got: Stance): "match" | "near" | "strict" | "lenient" | "soft" {
  if (expected === got) return "match";
  const rank = { allowed: 0, with_disclosure: 1, not_allowed: 2 } as const;
  if (expected === "unclear" || got === "unclear") return "soft";
  if (Math.abs(rank[expected] - rank[got]) === 1 && expected !== "not_allowed" && got !== "not_allowed") return "near";
  return rank[got] > rank[expected] ? "strict" : "lenient";
}

async function propose() {
  const imported = JSON.parse(readFileSync(IMPORTED, "utf8")) as PolicyCase[];
  let n = 0;
  for (const p of imported) {
    if (Object.keys(p.expected).length) continue;
    p.expected = await stancesFrom("course AI policy", p.policy);
    (p as PolicyCase & { labelsProposed?: boolean }).labelsProposed = true;
    n++;
    process.stdout.write(".");
  }
  writeFileSync(IMPORTED, JSON.stringify(imported, null, 2));
  console.log(`\nProposed labels for ${n} policies. Review them in ${IMPORTED} and delete "labelsProposed" once checked.`);
}

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("Set ANTHROPIC_API_KEY first.");
    process.exit(1);
  }
  if (process.argv.includes("--propose")) return propose();

  const prefix = process.argv.slice(2).find((a) => !a.startsWith("--")) ?? "";
  let imported: PolicyCase[] = [];
  try {
    imported = JSON.parse(readFileSync(IMPORTED, "utf8"));
  } catch {
    imported = [];
  }
  const cases = [...POLICY_CASES, ...imported].filter(
    (p) => p.id.startsWith(prefix) && Object.keys(p.expected).length > 0 && !(p as { labelsProposed?: boolean }).labelsProposed
  );
  console.log(`Checking rules cards for ${cases.length} labeled policies...\n`);

  const tally = { match: 0, near: 0, soft: 0, strict: 0, lenient: 0 };
  const rows: unknown[] = [];
  for (let i = 0; i < cases.length; i += 3) {
    const batch = cases.slice(i, i + 3);
    const results = await Promise.all(
      batch.map(async (p) => {
        try {
          const card = await generateRulesCard({ syllabus: p.policy, title: p.assignment.title, instructions: p.assignment.instructions });
          const got = await stancesFrom("rules card", cardText(card));
          return { p, card, got };
        } catch (e) {
          return { p, error: String(e) };
        }
      })
    );
    for (const r of results) {
      if ("error" in r) {
        console.log(`ERR  ${r.p.id}  ${r.error}`);
        continue;
      }
      const marks: string[] = [];
      for (const [use, exp] of Object.entries(r.p.expected) as [Use, Stance][]) {
        const g = grade(exp, r.got[use]);
        tally[g]++;
        if (g !== "match") marks.push(`${use}: expected ${exp}, card ${r.got[use]} (${g})`);
      }
      const bad = marks.some((m) => m.endsWith("(strict)") || m.endsWith("(lenient)"));
      console.log(`${bad ? "XX " : marks.length ? "~  " : "ok "} ${r.p.id.padEnd(26)} ${r.p.discipline}`);
      for (const m of marks) console.log(`      ${m}`);
      rows.push({ id: r.p.id, expected: r.p.expected, got: r.got, card: r.card });
    }
  }

  const total = Object.values(tally).reduce((a, b) => a + b, 0) || 1;
  const pct = (n: number) => `${Math.round((n / total) * 100)}%`;
  console.log(`\n${total} labeled uses across ${cases.length} policies`);
  console.log(`  exact match      ${tally.match} (${pct(tally.match)})`);
  console.log(`  near miss        ${tally.near} (${pct(tally.near)})   allowed vs with_disclosure`);
  console.log(`  soft miss        ${tally.soft} (${pct(tally.soft)})   one side was "unclear"`);
  console.log(`  too strict       ${tally.strict} (${pct(tally.strict)})   card forbids what the policy allows`);
  console.log(`  too lenient      ${tally.lenient} (${pct(tally.lenient)})   card allows what the policy forbids`);
  const file = `eval-rules-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-")}.json`;
  writeFileSync(file, JSON.stringify({ tally, rows }, null, 2));
  console.log(`\nFull results: ${file}`);
}

main();
