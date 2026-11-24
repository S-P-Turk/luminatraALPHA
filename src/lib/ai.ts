import Anthropic from "@anthropic-ai/sdk";
import { AsyncLocalStorage } from "node:async_hooks";

// The database is imported lazily so the command-line test runner (no DB)
// still works: settings fall back to defaults and logging is skipped.
async function getDb() {
  try {
    return (await import("@/src/prisma/db")).db;
  } catch {
    return null;
  }
}

// Every Claude call goes through callClaude(): it enforces the monthly
// budget hard stop and records tokens, estimated cost and timing in ApiCall
// for the admin spending page.

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export type Step = "analysis" | "grading" | "suggestions" | "lab" | "eval";

// Estimated price per million tokens. Override with env vars if the model's
// real pricing differs; the spending page shows these as estimates.
export const PRICE_IN = Number(process.env.AI_PRICE_INPUT_PER_MTOK ?? 3);
export const PRICE_OUT = Number(process.env.AI_PRICE_OUTPUT_PER_MTOK ?? 15);

export function costOf(inputTokens: number, outputTokens: number): number {
  return (inputTokens * PRICE_IN + outputTokens * PRICE_OUT) / 1_000_000;
}

// Context set by callers (e.g. "this is the test lab", "for class 3") so
// shared functions like generateQuiz don't need extra parameters.
export type Tally = { costUsd: number; calls: number };
type Ctx = { step?: Step; classId?: number | null; tally?: Tally };
const ctx = new AsyncLocalStorage<Ctx>();

export function withAiContext<T>(c: Ctx, fn: () => Promise<T>): Promise<T> {
  return ctx.run({ ...ctx.getStore(), ...c }, fn);
}

// ---------------------------------------------------------------- settings

export type BudgetSettings = { monthlyBudget: number; alertAt: number; hardStop: boolean };
export const DEFAULT_SETTINGS: BudgetSettings = { monthlyBudget: 50, alertAt: 0.8, hardStop: true };

export async function getSettings(): Promise<BudgetSettings> {
  const db = await getDb();
  let rows: { key: string; value: string }[] = [];
  try {
    rows = db ? await db.orm.public.AdminSetting.all() : [];
  } catch {
    rows = [];
  }
  const get = (k: string) => rows.find((r) => r.key === k)?.value;
  return {
    monthlyBudget: Number(get("monthlyBudget") ?? DEFAULT_SETTINGS.monthlyBudget),
    alertAt: Number(get("alertAt") ?? DEFAULT_SETTINGS.alertAt),
    hardStop: (get("hardStop") ?? String(DEFAULT_SETTINGS.hardStop)) === "true",
  };
}

export async function saveSetting(key: keyof BudgetSettings, value: string): Promise<void> {
  const db = (await getDb())!;
  const existing = await db.orm.public.AdminSetting.where({ key }).first();
  if (existing) await db.orm.public.AdminSetting.where({ id: existing.id }).update({ value });
  else await db.orm.public.AdminSetting.create({ key, value });
}

export function monthStart(d = new Date()): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

/** All calls this month. Beta-sized table, so summing in code is fine. */
export async function monthCalls(start = monthStart()) {
  const db = (await getDb())!;
  const all = await db.orm.public.ApiCall.orderBy((c) => c.createdAt.desc()).all();
  return all.filter((c) => new Date(c.createdAt) >= start);
}

// Short cache so a burst of calls doesn't re-sum the table every time.
let spendCache: { at: number; value: number } | null = null;
async function monthSpend(): Promise<number> {
  if (spendCache && Date.now() - spendCache.at < 30_000) return spendCache.value;
  let value = 0;
  try {
    value = (await monthCalls()).reduce((s, c) => s + c.costUsd, 0);
  } catch {
    value = 0; // no database (CLI): no budget to enforce
  }
  spendCache = { at: Date.now(), value };
  return value;
}

export class BudgetPausedError extends Error {
  constructor() {
    super("Luminatra has paused new AI analysis for this month because the budget was reached. Please try again later.");
  }
}

// ---------------------------------------------------------------- the call

export async function callClaude(
  defaultStep: Step,
  params: Anthropic.MessageCreateParamsNonStreaming
): Promise<Anthropic.Message> {
  const c = ctx.getStore() ?? {};
  const step = c.step ?? defaultStep;

  const settings = await getSettings();
  if (settings.hardStop && (await monthSpend()) >= settings.monthlyBudget) {
    throw new BudgetPausedError();
  }

  const started = Date.now();
  let message: Anthropic.Message | null = null;
  let error: unknown = null;
  try {
    message = await anthropic.messages.create(params);
  } catch (e) {
    error = e;
  }
  const inputTokens = message?.usage?.input_tokens ?? 0;
  const outputTokens = message?.usage?.output_tokens ?? 0;
  const costUsd = costOf(inputTokens, outputTokens);
  try {
    const db = await getDb();
    if (db) await db.orm.public.ApiCall.create({
      step,
      model: params.model,
      inputTokens,
      outputTokens,
      costUsd,
      durationMs: Date.now() - started,
      ok: !error,
      classId: c.classId ?? null,
    });
    if (spendCache) spendCache = { at: spendCache.at, value: spendCache.value + costUsd };
    if (c.tally) {
      c.tally.costUsd += costUsd;
      c.tally.calls += 1;
    }
  } catch {
    // Logging must never break the actual feature.
  }
  if (error) throw error;
  return message!;
}
