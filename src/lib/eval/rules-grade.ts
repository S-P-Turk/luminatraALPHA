// Pure scoring for the rules-card check (no server imports), so the test lab
// can re-score a saved run in the browser when labels change.

import type { PolicyCase, Stance, Use } from "./policies";

export type Grade = "match" | "defensible" | "near" | "soft" | "strict" | "lenient";
export const GRADES: Grade[] = ["match", "defensible", "near", "soft", "strict", "lenient"];

// with_disclosure vs allowed is a near miss; anything vs unclear is a soft miss.
export function grade(expected: Stance, got: Stance, alsoOk?: Stance[]): Grade {
  if (expected === got) return "match";
  if (alsoOk?.includes(got)) return "defensible";
  const rank = { allowed: 0, with_disclosure: 1, not_allowed: 2 } as const;
  if (expected === "unclear" || got === "unclear") return "soft";
  if (Math.abs(rank[expected] - rank[got]) === 1 && expected !== "not_allowed" && got !== "not_allowed") return "near";
  return rank[got] > rank[expected] ? "strict" : "lenient";
}

export type Miss = { use: Use; expected: Stance; got: Stance; grade: Grade; why?: string };

export function gradeCase(p: PolicyCase, got: Partial<Record<Use, Stance>>) {
  const tally = Object.fromEntries(GRADES.map((g) => [g, 0])) as Record<Grade, number>;
  const misses: Miss[] = [];
  for (const [use, exp] of Object.entries(p.expected) as [Use, Stance][]) {
    const g = grade(exp, (got[use] ?? "unclear") as Stance, p.alsoOk?.[use]?.stances);
    tally[g]++;
    if (g !== "match") misses.push({ use, expected: exp, got: (got[use] ?? "unclear") as Stance, grade: g, why: p.alsoOk?.[use]?.why });
  }
  // A teacher confirming the card would change every row that isn't exact or defensible.
  const teacherFixes = misses.filter((m) => m.grade !== "defensible").length;
  return { tally, misses, teacherFixes };
}
