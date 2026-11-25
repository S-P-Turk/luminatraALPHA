// Imports real course AI policies from a CSV (for example the crowdsourced
// "Syllabi Policies for AI Generative Tools" sheet: File > Download > CSV)
// into src/lib/eval/policies-imported.json.
//
// Run:  npx tsx scripts/eval/import-policies.ts path/to/file.csv "https://source-url"
//
// Columns are matched by name, case-insensitive: one containing "policy" (or
// "guideline"/"statement") is required; "course", "institution"/"school", and
// "discipline"/"field"/"subject" are used when present. Imported policies
// start unlabeled (expected = {}); run eval-rules.ts --propose to have Claude
// suggest labels, then review them by hand before trusting the results.

import { readFileSync, writeFileSync } from "node:fs";
import type { PolicyCase } from "../../src/lib/eval/policies";

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); rows.push(row); row = []; cell = "";
    } else cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim()));
}

const [file, source = ""] = process.argv.slice(2);
if (!file) {
  console.error('Usage: npx tsx scripts/eval/import-policies.ts file.csv "https://source-url"');
  process.exit(1);
}

const rows = parseCsv(readFileSync(file, "utf8"));
// Header is the first row that has a policy-like column.
const headerIdx = rows.findIndex((r) => r.some((c) => /policy|guideline|statement/i.test(c)));
if (headerIdx < 0) {
  console.error("Couldn't find a column with 'policy', 'guideline' or 'statement' in its name.");
  process.exit(1);
}
const header = rows[headerIdx].map((h) => h.toLowerCase());
const col = (re: RegExp) => header.findIndex((h) => re.test(h));
const cPolicy = col(/policy|guideline|statement/);
const cCourse = col(/course|class/);
const cInst = col(/institution|school|university|college/);
const cField = col(/discipline|field|subject|department/);

const seen = new Set<string>();
const out: PolicyCase[] = [];
for (const r of rows.slice(headerIdx + 1)) {
  const policy = (r[cPolicy] ?? "").trim();
  if (policy.length < 40) continue; // blank or placeholder rows
  const key = policy.slice(0, 200).toLowerCase();
  if (seen.has(key)) continue;
  seen.add(key);
  const course = [cCourse >= 0 ? r[cCourse] : "", cInst >= 0 ? r[cInst] : ""].map((s) => (s ?? "").trim()).filter(Boolean).join(" · ");
  out.push({
    id: `imp-${String(out.length + 1).padStart(3, "0")}`,
    discipline: (cField >= 0 ? r[cField] : "")?.trim() || "Unspecified",
    level: "intro",
    tier: "mixed",
    course: course || "Unspecified course",
    policy,
    // Imported rows have no assignment; a generic one keeps the rules card honest.
    assignment: { title: "Written assignment", instructions: "Complete the written assignment for this unit as described in class." },
    expected: {},
    origin: "imported",
    source,
  });
}

writeFileSync("src/lib/eval/policies-imported.json", JSON.stringify(out, null, 2));
console.log(`Imported ${out.length} policies (${rows.length - headerIdx - 1} rows read, duplicates and blanks skipped).`);
console.log("Wrote src/lib/eval/policies-imported.json. These are for internal testing only; don't republish them.");
