// Checks how well the rules cards read real-world AI policies.
//
// For each labeled policy: write the rules card exactly as the app does, then
// have a separate, narrowly-prompted Claude call read ONLY the card and say
// what it permits for six common uses. Compare with the hand labels.
//
//   Key goes in .env.local (ANTHROPIC_API_KEY=sk-ant-...), not the terminal.
//   npx tsx scripts/eval/eval-rules.ts            # all labeled
//   npx tsx scripts/eval/eval-rules.ts real-      # only the real policies
//   npx tsx scripts/eval/eval-rules.ts pol-cs     # id prefix
//   npx tsx scripts/eval/eval-rules.ts --propose  # suggest labels for imported policies
//
// The two errors that matter most:
//   strict  - the card forbids something the policy allows (students get
//             wrongly scared off, teachers get false flags)
//   lenient - the card allows something the policy forbids (the rule the
//             teacher cares about never reaches the student)

import "./env";
import { readFileSync, writeFileSync } from "node:fs";
import { POLICY_CASES, type PolicyCase } from "../../src/lib/eval/policies";
import { checkPolicy, stancesFrom } from "../../src/lib/eval/rules-check";
import { REAL_POLICY_CASES } from "../../src/lib/eval/policies-real";

const IMPORTED = "src/lib/eval/policies-imported.json";

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
    console.error("No ANTHROPIC_API_KEY. Put it in .env.local in the repo root:  ANTHROPIC_API_KEY=sk-ant-...");
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
  const cases = [...REAL_POLICY_CASES, ...POLICY_CASES, ...imported].filter(
    (p) => p.id.startsWith(prefix) && Object.keys(p.expected).length > 0 && !(p as { labelsProposed?: boolean }).labelsProposed
  );
  console.log(`Checking rules cards for ${cases.length} labeled policies...\n`);

  const tally = { match: 0, near: 0, soft: 0, strict: 0, lenient: 0 };
  const rows: unknown[] = [];
  for (let i = 0; i < cases.length; i += 3) {
    const batch = cases.slice(i, i + 3);
    const results = await Promise.all(
      batch.map((p) => checkPolicy(p).then((r) => ({ p, r }), (e) => ({ p, error: String(e) })))
    );
    for (const x of results) {
      if ("error" in x) {
        console.log(`ERR  ${x.p.id}  ${x.error}`);
        continue;
      }
      const { p, r } = x;
      for (const k of Object.keys(tally) as (keyof typeof tally)[]) tally[k] += r.tally[k];
      const marks = r.misses.map((m) => `${m.use}: expected ${m.expected}, card ${m.got} (${m.grade})`);
      const bad = r.misses.some((m) => m.grade === "strict" || m.grade === "lenient");
      console.log(`${bad ? "XX " : marks.length ? "~  " : "ok "} ${p.id.padEnd(26)} ${p.discipline}`);
      for (const m of marks) console.log(`      ${m}`);
      rows.push({ id: p.id, expected: p.expected, got: r.got, card: r.card });
    }
  }

  const total = Object.values(tally).reduce((a, b) => a + b, 0);
  if (total === 0) {
    console.log("\nNo results: every policy errored. Check the API key and connection.");
    return;
  }
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
