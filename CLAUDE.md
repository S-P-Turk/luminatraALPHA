# Luminatra: handoff for Claude Code

Read `AGENTS.md` first: this repo uses a newer Next.js with breaking changes (Cache Components, React Activity keeps ~3 routes alive, `RouteContext<"/path">`, `export const instant = false`, `connection()` to force dynamic). Check `node_modules/next/dist/docs/` before writing Next code.

## What Luminatra is

An AI-use review tool for college courses. A student submits their work plus the full AI chat transcript. Luminatra compares them against the course syllabus, writes a 2-question comprehension quiz, and gives a 0–100 **follow-up priority** that tells the teacher whether to take a closer look. Founder: SP ("Patrick") Turk, USC. Preparing a teacher pilot.

Live: https://luminatra-alpha.vercel.app (admin at `/admin`). Vercel deploys every push to `main` of `S-P-Turk/luminatraALPHA`. Vercel project `prj_nlxQq6mVcQJI7Y9OGR0N94UPAEwt`, team `team_fSFgGkW0aGCBbcE6LKKbXfk6`.

## Product decisions (made by the founder; don't change without asking)

- **No "failures" or "violations".** Every flag only suggests a follow-up for human review. Teachers decide.
- **Score** = Luminatra's own layer on top of Claude (`src/lib/scoring.ts`, `SCORING_VERSION` v3.1). Weights: comprehension 45 / AI reliance 30 / syllabus rules 25. Review threshold **40**; any maxed signal also goes to review. Teachers only see flags; students see their score only **after** submitting.
- **AI reliance** is measured per paragraph (ideas vs wording; levels none / ideas / heavy / written). Disclosure is inferred by the model. Deterministic caps in `reliance.ts` / `contribution.ts`.
- **Quiz**: 2 questions, one-sentence answers each. Starts only when the teacher presses **Activate quiz**.
- **Rules card**: a per-use grid (brainstorm, grammar, paraphrase, draft, research, code) plus disclosure, generated from the syllabus when an assignment is created (`src/lib/rules.ts`). Teachers see "gaps" the policy doesn't answer. Students see it before writing.
- **Per-assignment AI rules choice**: teachers pick "Same as syllabus" (default; syllabus stays the authority), "No AI use allowed", or "Custom" (edit each use + disclosure). No AI / Custom override the syllabus in the analysis (`confirmedRulesText`). "Not sure" on a use means follow-up, never a rule broken. The syllabus reading is kept in `fromSyllabus` so teachers can switch back.
- **After submitting** students see exact score, points per signal, which paragraphs lean on AI, and "what would change your score" (`scoreLevers`). **One resubmission** before the quiz starts. On revision the assignment text can be replaced but the AI chat is **append-only** (original locked). Every prior version is kept in `Submission.revisions` for the teacher.
- **Privacy**: the student's name and email are replaced with `[STUDENT]` before any Claude call (`src/lib/redact.ts`). Student work still goes to the Anthropic API (standard retention, no training). Option discussed but not done: move to Amazon Bedrock with Sonnet + `data_retention_mode: none` so Anthropic never receives student work.
- **Admin console** style: "graph paper" look (Chivo / Chivo Mono, outlined cells, signal yellow `#E9D758`, square corners), **no grid background**, dense, plain specific labels, no decorative stats. Tabs: overview (o), test lab (t), API spending (s), model quality (q), cybersecurity (c, intentionally blank for now).
- Tone with the founder: professional, brutally honest about decisions, committed to success. Don't say "Patrick" in every message.

## Architecture

- `src/lib/ai.ts` `callClaude(step, params)`: every Claude call goes through it. `MODELS.main` = `claude-sonnet-5` (analysis, quiz questions), `MODELS.fast` = `claude-haiku-5-5` (rules cards, quiz grading). Per-model pricing: Sonnet 5 $2/$10, Haiku 5.5 $0.10/$0.50 per MTok (before 2026-11-28 the app logged $3/$15, so older ApiCall costs are ~50% high). Logs tokens/cost to `ApiCall` (cache tokens counted), enforces the monthly budget hard stop (`AdminSetting` monthlyBudget/alertAt/hardStop), prompt caching on system prompts, `withAiContext({step, classId})`.
- `src/lib/analyze.ts`: background analysis after submit (`after()` from next/server). Score first, quiz later: `analyzeSubmission` (tool `submit_analysis`, no quiz) sets the score, then `writeQuizQuestions` (tool `submit_questions`) fills the 2 questions. If they're missing when the quiz opens, the student GET route calls `ensureQuizQuestions`. No-AI fast path: `noAiUsed(transcript)` skips the model entirely. Status `analyzing` → scored, or `analysis_failed` (student can retry without using a revision). Student page polls every 3 s and shows `AnalyzingCard` (steps + "Please don't close this page").
- `src/lib/quiz.ts` (generateQuiz, gradeAnswers), `grading.ts` (gradeIfNeeded, nextStatus, forStudent, MAX_REVISIONS), `scoring.ts`, `reliance.ts`, `contribution.ts`, `rules.ts`, `redact.ts`.
- Prisma 8 contract ORM: schema in `src/prisma/contract.prisma`; regenerate with `npx prisma contract emit`; deploy runs `prisma db update --yes`. Query style: `db.orm.public.Model.where({...}).select(...).first()/all()/update()/create()`.
- Teacher review pages grade waiting quiz answers in parallel (`app/api/review`, `app/api/classes/[id]/submissions`).
- Admin auth: `ADMIN_PASSWORD` env, cookie `lum_admin`. Sessions HMAC-signed with `SESSION_SECRET`.

Env vars (values in Vercel, never commit them): `DATABASE_URL`, `ANTHROPIC_API_KEY`, `ADMIN_PASSWORD`, `SESSION_SECRET`, optional `AI_PRICE_INPUT_PER_MTOK` / `AI_PRICE_OUTPUT_PER_MTOK`.

## Testing

- `scripts/eval/`: 36-case student test set (`src/lib/eval/cases.ts`), runnable from the admin test lab or CLI. History: v1 93%, v3 31/31 decisions & 24/29 reliance labels, v3.1 replay 29/29. **A fresh live run of v3.1 has not been done.**
- Syllabus library: `src/lib/eval/policies-real.ts` (39 real course AI policies, condensed, with source links; internal testing only, don't publish) and `policies.ts` (30 written examples). `scripts/eval/eval-rules.ts` checks rules cards against hand labels; `import-policies.ts` loads a CSV (e.g. the crowdsourced sheet at bit.ly/Syllabi-AI-Policies).
- Everything shipped on 2026-11-25 was tested only against a mock Claude server (the previous environment had no API key): rules cards, score levers, background analysis, revisions, redaction, rules eval.

## API key (read this before asking about it)

Claude Code itself runs on the founder's claude.ai login and needs no API key. Only the eval scripts call the Anthropic API; they read `ANTHROPIC_API_KEY` from `.env.local` in the repo root (gitignored). Never ask the founder to export the key in the terminal (that makes Claude Code offer to switch to API billing) and never ask him to paste it into chat. If `.env.local` is missing or has no key, say so once, in one line, and continue with work that doesn't need it (steps 3–5 below).

## Do next (in order)

1. `npx tsx scripts/eval/eval-rules.ts real-` and fix any "too lenient" errors (card allows what the syllabus forbids).
2. Run the full 36-case test set against the real model; confirm v3.1 and the new student result view.
3. One live end-to-end pass on the deployed site: teacher creates assignment → rules card + gaps → student submits → score + levers → revise with added chat → activate quiz → teacher review.
4. Speed work shipped 2026-11-28 (split analysis, no-AI fast path, AI source text once, Haiku for rules/grading). Rerun the rules check and the full test set to confirm Haiku didn't cost accuracy; if rules accuracy drops, move `generateRulesCard` back to `MODELS.main`.
5. Pilot prep: one-page data-handling statement, student guide for pasting AI chats, ask the pilot school whether a data privacy agreement is required (decides Bedrock vs current setup).

Backlog ideas the founder picked: "who said it first" (idea provenance in the transcript), "solid vs shaky flags" (rerun near the 40 line and label stability). Founder does the adversarial test set himself.

## Conventions

- Commit to `main` and push; Vercel deploys. Check the deploy with the Vercel tools.
- End commit messages with the attribution lines your environment specifies.
- Lint: the `setState` / load-before-declared warnings in client components are a pre-existing pattern; don't churn them.
