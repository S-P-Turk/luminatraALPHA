# Luminatra model evaluation

`src/lib/eval/cases.ts` holds 30 synthetic cases: 3 course AI policies (strict, permissive-with-disclosure, no AI) × 10 student scenarios, each with the outcome an integrity officer would expect. `scripts/eval/run.ts` (and the admin page's "Run test set" button at /admin) runs the full pipeline on them (analyzer, a simulated student answering the quiz, grader, scoring layer) and reports accuracy, false positives and false negatives.

```bash
ANTHROPIC_API_KEY=sk-... npx tsx scripts/eval/run.ts          # all 30 (~90 API calls)
ANTHROPIC_API_KEY=sk-... npx tsx scripts/eval/run.ts hist     # one course
npx tsx scripts/scoring.test.ts                                # scoring math only, no API
```

Re-run after any change to prompts, weights or the threshold (`src/lib/scoring.ts`), and compare results. Real teacher decisions (`cleared` / `follow_up` on submissions) are the second, growing label set.
