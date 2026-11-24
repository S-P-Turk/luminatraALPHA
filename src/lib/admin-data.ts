import { db } from "@/src/prisma/db";
import { getSettings, monthStart, PRICE_IN, PRICE_OUT } from "@/src/lib/ai";
import { SCORING_VERSION, WEIGHTS, REVIEW_THRESHOLD, type ScoreCard } from "@/src/lib/scoring";

// Data for the admin screens, computed from the live tables. The beta is
// small, so rows are loaded and aggregated in code.

const DAY = 86_400_000;
const dayKey = (d: Date) => d.toISOString().slice(0, 10);

type Card = { scoreCard?: ScoreCard } | null;
const cardOf = (rc: unknown): ScoreCard | null => ((rc as Card)?.scoreCard ?? null);
const sentToReview = (s: { status: string; reportCard: unknown }) =>
  cardOf(s.reportCard)?.needsReview ?? s.status !== "submitted";

async function base() {
  const [teachers, students, enrollments, classes, assignments, submissions, runs] = await Promise.all([
    db.orm.public.Teacher.select("id", "email").all(),
    db.orm.public.Student.select("email").all(),
    db.orm.public.Enrollment.select("studentEmail").all(),
    db.orm.public.Class.select("id", "name", "teacherId").all(),
    db.orm.public.Assignment.select("id", "title", "open").all(),
    db.orm.public.Submission
      .select("id", "classId", "assignmentId", "studentName", "status", "reportCard", "createdAt", "updatedAt")
      .all(),
    db.orm.public.EvalRun.orderBy((r) => r.createdAt.desc()).all(),
  ]);
  return { teachers, students, enrollments, classes, assignments, submissions, runs };
}

async function spendSummary(now = new Date()) {
  const start = monthStart(now);
  const calls = (await db.orm.public.ApiCall.orderBy((c) => c.createdAt.desc()).all()).filter(
    (c) => new Date(c.createdAt) >= start
  );
  const total = calls.reduce((s, c) => s + c.costUsd, 0);
  const daysInMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)).getUTCDate();
  const elapsed = Math.max(1, (now.getTime() - start.getTime()) / DAY);
  const projected = (total / elapsed) * daysInMonth;
  return { calls, total, projected };
}

// ---------------------------------------------------------------- overview

export async function overviewData() {
  const now = new Date();
  const { teachers, students, enrollments, classes, assignments, submissions, runs } = await base();
  const settings = await getSettings();
  const spend = await spendSummary(now);

  const studentEmails = new Set([...students.map((s) => s.email), ...enrollments.map((e) => e.studentEmail)]);
  const thisMonth = monthStart(now);
  const lastMonth = monthStart(new Date(thisMonth.getTime() - DAY));
  const inRange = (d: Date, a: Date, b: Date) => d >= a && d < b;
  const subsThis = submissions.filter((s) => new Date(s.createdAt) >= thisMonth).length;
  const subsLast = submissions.filter((s) => inRange(new Date(s.createdAt), lastMonth, thisMonth)).length;
  const flagged = submissions.filter((s) => s.status === "flagged");
  const oldestFlagged = flagged.reduce<Date | null>((o, s) => {
    const d = new Date(s.createdAt);
    return !o || d < o ? d : o;
  }, null);

  // Last 30 days, per day.
  const days: { day: string; submitted: number; review: number }[] = [];
  for (let i = 29; i >= 0; i--) days.push({ day: dayKey(new Date(now.getTime() - i * DAY)), submitted: 0, review: 0 });
  for (const s of submissions) {
    const d = days.find((x) => x.day === dayKey(new Date(s.createdAt)));
    if (!d) continue;
    d.submitted++;
    if (sentToReview(s)) d.review++;
  }

  // Health, from the logged API calls.
  const day = spend.calls.filter((c) => now.getTime() - new Date(c.createdAt).getTime() < DAY);
  const errors24 = day.filter((c) => !c.ok).length;
  const analyses = spend.calls.filter((c) => c.step === "analysis" && c.ok).slice(0, 50);
  const avgAnalysisMs = analyses.length ? analyses.reduce((s, c) => s + c.durationMs, 0) / analyses.length : null;
  const lastCall = spend.calls[0] ?? null;
  const confirmed = runs.some((r) => r.version === SCORING_VERSION);

  // Needs attention.
  const attention: { kind: "warn" | "todo" | "info"; title: string; text: string; href?: string; link?: string }[] = [];
  const pct = settings.monthlyBudget > 0 ? spend.total / settings.monthlyBudget : 0;
  if (pct >= settings.alertAt) {
    attention.push({ kind: "warn", title: `API budget at ${Math.round(pct * 100)}%.`, text: `$${spend.total.toFixed(2)} of $${settings.monthlyBudget.toFixed(2)} this month.`, href: "/admin/spending", link: "spending" });
  } else if (spend.projected > settings.monthlyBudget * settings.alertAt) {
    attention.push({ kind: "info", title: `On pace for ${Math.round((spend.projected / settings.monthlyBudget) * 100)}% of budget.`, text: `Projected $${spend.projected.toFixed(2)} by month end.`, href: "/admin/spending", link: "spending" });
  }
  if (!confirmed) {
    attention.push({ kind: "todo", title: `Scoring ${SCORING_VERSION} is unconfirmed.`, text: "Run the test set to confirm it.", href: "/admin/lab#test-set", link: "test lab" });
  }
  const stale = flagged.filter((s) => now.getTime() - new Date(s.createdAt).getTime() > 2 * DAY).length;
  if (stale) attention.push({ kind: "info", title: `${stale} submission${stale === 1 ? "" : "s"} waiting 2+ days`, text: "for teacher review." });
  if (errors24) attention.push({ kind: "warn", title: `${errors24} failed AI call${errors24 === 1 ? "" : "s"} in 24 h.`, text: "Check the AI service." });

  // Recent activity, derived from submissions.
  const className = new Map(classes.map((c) => [c.id, c.name]));
  const assignmentTitle = new Map(assignments.map((a) => [a.id, a.title]));
  const events: { at: string; who: string; what: string; where: string }[] = [];
  for (const s of submissions) {
    const score = cardOf(s.reportCard)?.score;
    events.push({
      at: new Date(s.createdAt).toISOString(),
      who: s.studentName,
      what: `Submitted ${assignmentTitle.get(s.assignmentId) ?? "an assignment"}${score != null ? ` · priority ${score}` : ""}`,
      where: className.get(s.classId) ?? "",
    });
    if (s.status === "cleared" || s.status === "follow_up") {
      events.push({
        at: new Date(s.updatedAt).toISOString(),
        who: "Teacher",
        what: `${s.status === "cleared" ? "Cleared" : "Marked for follow-up"}: ${s.studentName}`,
        where: className.get(s.classId) ?? "",
      });
    }
  }
  events.sort((a, b) => b.at.localeCompare(a.at));

  return {
    stats: {
      teachers: teachers.length,
      students: studentEmails.size,
      classes: classes.length,
      openAssignments: assignments.filter((a) => a.open).length,
      submissions: submissions.length,
      submissionsThisMonth: subsThis,
      submissionsLastMonth: subsLast,
      awaitingReview: flagged.length,
      oldestFlaggedDays: oldestFlagged ? Math.floor((now.getTime() - oldestFlagged.getTime()) / DAY) : null,
    },
    days,
    attention,
    health: {
      aiStatus: !lastCall ? "no calls yet" : lastCall.ok ? "operational" : "last call failed",
      errorRate24h: day.length ? errors24 / day.length : 0,
      calls24h: day.length,
      avgAnalysisMs,
      scoringVersion: SCORING_VERSION,
      confirmed,
      deploy: process.env.VERCEL_GIT_COMMIT_SHA ? process.env.VERCEL_GIT_COMMIT_SHA.slice(0, 7) : "local",
      deployMessage: (process.env.VERCEL_GIT_COMMIT_MESSAGE ?? "").split("\n")[0],
    },
    activity: events.slice(0, 8),
    budget: { spent: spend.total, budget: settings.monthlyBudget },
  };
}

// ---------------------------------------------------------------- spending

export async function spendingData() {
  const now = new Date();
  const settings = await getSettings();
  const { calls, total, projected } = await spendSummary(now);
  const start = monthStart(now);
  const t0 = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const sum = (xs: typeof calls) => xs.reduce((s, c) => s + c.costUsd, 0);

  const today = sum(calls.filter((c) => new Date(c.createdAt) >= t0));
  const week = sum(calls.filter((c) => now.getTime() - new Date(c.createdAt).getTime() < 7 * DAY));

  const submissions = (await db.orm.public.Submission.select("id", "classId", "createdAt").all()).filter(
    (s) => new Date(s.createdAt) >= start
  );
  const studentCost = sum(calls.filter((c) => c.step === "analysis" || c.step === "grading"));
  const perSubmission = submissions.length ? studentCost / submissions.length : null;

  const steps = ["analysis", "grading", "lab", "eval", "suggestions"] as const;
  const byStep = steps.map((step) => ({ step, cost: sum(calls.filter((c) => c.step === step)), calls: calls.filter((c) => c.step === step).length }));

  const daysInMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)).getUTCDate();
  const daily = Array.from({ length: daysInMonth }, (_, i) => {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), i + 1));
    const key = dayKey(d);
    return { day: key, cost: sum(calls.filter((c) => dayKey(new Date(c.createdAt)) === key)), future: d > now };
  });

  const classes = await db.orm.public.Class.select("id", "name", "teacherId").all();
  const teachers = await db.orm.public.Teacher.select("id", "email").all();
  const byClass = classes
    .map((cl) => {
      const cc = calls.filter((c) => c.classId === cl.id);
      return {
        name: cl.name,
        teacher: teachers.find((t) => t.id === cl.teacherId)?.email ?? "",
        submissions: submissions.filter((s) => s.classId === cl.id).length,
        cost: sum(cc),
      };
    })
    .filter((r) => r.cost > 0 || r.submissions > 0);
  const testing = calls.filter((c) => c.step === "lab" || c.step === "eval");
  if (testing.length) byClass.push({ name: "Test lab & test set", teacher: "admin", submissions: testing.length, cost: sum(testing) });
  byClass.sort((a, b) => b.cost - a.cost);

  return {
    month: start.toISOString().slice(0, 7),
    today,
    week,
    total,
    projected,
    perSubmission,
    settings,
    byStep,
    daily,
    byClass,
    calls: calls.length,
    prices: { input: PRICE_IN, output: PRICE_OUT },
  };
}

// ---------------------------------------------------------------- quality

export async function qualityData() {
  const { submissions, runs, classes } = await base();
  const className = new Map(classes.map((c) => [c.id, c.name]));
  const reviewed = submissions.filter((s) => (s.status === "cleared" || s.status === "follow_up") && sentToReview(s));
  const followed = reviewed.filter((s) => s.status === "follow_up").length;

  const bins = Array.from({ length: 10 }, (_, i) => ({ from: i * 10, count: 0 }));
  for (const s of submissions) {
    const sc = cardOf(s.reportCard)?.score;
    if (sc == null) continue;
    bins[Math.min(9, Math.floor(sc / 10))].count++;
  }

  const cleared = submissions
    .filter((s) => s.status === "cleared" && sentToReview(s))
    .map((s) => {
      const card = cardOf(s.reportCard);
      const top = card
        ? Object.entries(card.signals)
            .filter(([, v]) => v.points > 0)
            .sort((a, b) => b[1].points - a[1].points)[0]
        : undefined;
      return {
        score: card?.score ?? null,
        reason: top ? `${top[0] === "reliance" ? "AI reliance" : top[0] === "policy" ? "Syllabus" : "Comprehension"}: ${top[1].reason}` : "—",
        className: className.get(s.classId) ?? "",
        student: s.studentName,
        at: new Date(s.updatedAt).toISOString(),
      };
    })
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 10);

  return {
    version: SCORING_VERSION,
    weights: WEIGHTS,
    threshold: REVIEW_THRESHOLD,
    latest: runs[0] ?? null,
    confirmed: runs.some((r) => r.version === SCORING_VERSION),
    runs: runs.slice(0, 8).reverse().map((r) => ({
      id: r.id,
      version: r.version,
      at: new Date(r.createdAt).toISOString(),
      total: r.total,
      judged: r.judged,
      correct: r.correct,
      relianceJudged: r.relianceJudged,
      relianceCorrect: r.relianceCorrect,
      costUsd: r.costUsd,
    })),
    agreement: reviewed.length ? { followed, total: reviewed.length } : null,
    bins,
    scored: bins.reduce((s, b) => s + b.count, 0),
    cleared,
  };
}
