// CLI for the evaluation set. Same logic as the admin "Run test set" button.
// Run:  ANTHROPIC_API_KEY=sk-... npx tsx scripts/eval/run.ts [case-id-prefix]

import { writeFileSync } from "node:fs";
import { CASES } from "../../src/lib/eval/cases";
import { runCase, summarize, type CaseResult } from "../../src/lib/eval/run-case";
import { REVIEW_THRESHOLD, WEIGHTS, SCORING_VERSION } from "../../src/lib/scoring";

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("Set ANTHROPIC_API_KEY first.");
    process.exit(1);
  }
  const prefix = process.argv[2] ?? "";
  const cases = CASES.filter((c) => c.id.startsWith(prefix));
  console.log(
    `Scoring ${SCORING_VERSION} | weights comprehension ${WEIGHTS.comprehension} / reliance ${WEIGHTS.reliance} / policy ${WEIGHTS.policy} | threshold ${REVIEW_THRESHOLD}\nRunning ${cases.length} cases...\n`
  );

  const results: CaseResult[] = [];
  let errors = 0;
  for (let i = 0; i < cases.length; i += 3) {
    const batch = await Promise.all(
      cases.slice(i, i + 3).map((c) => runCase(c).catch((e) => ({ id: c.id, error: String(e) })))
    );
    for (const r of batch) {
      if ("error" in r) {
        errors++;
        console.log(`ERR  ${r.id}  ${r.error}`);
        continue;
      }
      results.push(r);
      const s = r.card.signals;
      const mark = r.correct === null ? "~  " : r.correct ? "ok " : "XX ";
      console.log(
        `${mark} ${r.id}  score ${String(r.card.score).padStart(3)}  [comp ${s.comprehension.points} | reliance ${s.reliance.points} | policy ${s.policy.points}]  expect ${r.expect.padEnd(9)} got ${r.actual.padEnd(9)} ${r.scenario}`
      );
    }
  }

  const sum = summarize(results);
  console.log(`\nAccuracy: ${sum.correct}/${sum.judged} (${sum.accuracy}%)`);
  console.log(`Unneeded reviews (false positives): ${sum.falsePositives.length}  ${sum.falsePositives.join(", ")}`);
  console.log(`Missed reviews (false negatives):   ${sum.falseNegatives.length}  ${sum.falseNegatives.join(", ")}`);
  console.log(`Borderline (not scored): ${sum.borderline}  Errors: ${errors}`);

  const out = `scripts/eval/results-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-")}.json`;
  writeFileSync(out, JSON.stringify(results, null, 2));
  console.log(`Details: ${out}`);
}

void main();
