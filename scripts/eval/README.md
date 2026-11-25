# Luminatra model evaluation

`src/lib/eval/cases.ts` holds 30 synthetic cases: 3 course AI policies (strict, permissive-with-disclosure, no AI) × 10 student scenarios, each with the outcome an integrity officer would expect. `scripts/eval/run.ts` (and the admin page's "Run test set" button at /admin) runs the full pipeline on them (analyzer, a simulated student answering the quiz, grader, scoring layer) and reports accuracy, false positives and false negatives.

```bash
ANTHROPIC_API_KEY=sk-... npx tsx scripts/eval/run.ts          # all 30 (~90 API calls)
ANTHROPIC_API_KEY=sk-... npx tsx scripts/eval/run.ts hist     # one course
npx tsx scripts/scoring.test.ts                                # scoring math only, no API
```

Re-run after any change to prompts, weights or the threshold (`src/lib/scoring.ts`), and compare results. Real teacher decisions (`cleared` / `follow_up` on submissions) are the second, growing label set.

## Syllabus library (rules cards)

`src/lib/eval/policies.ts` holds 30 course AI policies across 29 disciplines and five tiers (prohibited, limited, disclosure, open, mixed), each with an assignment and hand labels for what it says about six uses: brainstorm, grammar, paraphrase, draft, research, code. They are synthetic but mirror patterns in published policies: tool-specific rules, assignment-level exceptions, privacy rules on top of AI rules, vague wording, contradictions. Each has a `quirk` saying what makes it hard.

```bash
ANTHROPIC_API_KEY=sk-... npx tsx scripts/eval/eval-rules.ts        # ~60 calls, well under $1
```

It writes each rules card the way the app does, has a separate call read only the card, and compares to the labels. Watch "too strict" (card forbids what the policy allows) and "too lenient" (card allows what the policy forbids).

### Adding real policies

1. Download a policy collection as CSV, e.g. the crowdsourced "Syllabi Policies for AI Generative Tools" sheet (bit.ly/Syllabi-AI-Policies, File > Download > CSV).
2. `npx tsx scripts/eval/import-policies.ts file.csv "<source url>"` writes `src/lib/eval/policies-imported.json`.
3. `ANTHROPIC_API_KEY=... npx tsx scripts/eval/eval-rules.ts --propose` suggests labels. Review them by hand and remove `labelsProposed`; proposed labels are skipped in scoring until you do.

Imported policies were written by individual instructors. Use them for internal testing only and don't republish them.

The policies also appear in the admin test lab's preset menu under "Syllabus library".
