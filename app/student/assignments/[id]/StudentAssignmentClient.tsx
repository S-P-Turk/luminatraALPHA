"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Spinner, WorkingNote, AnalyzingCard } from "@/src/components/Spinner";
import { toast } from "@/src/components/Toaster";
import { UsesGrid } from "@/src/components/UsesGrid";
import type { CardUse, UseStance } from "@/src/lib/rules-shared";

type QuizQuestion = {
  question: string;
  what_it_tests: string;
  expected_length?: "one_sentence" | "two_sentences";
};
type Quiz = {
  policy_summary: string;
  policy_concern: string | null;
  claimed_unassisted_areas: string[];
  quiz: QuizQuestion[];
};

type Result = {
  score: number;
  threshold: number;
  needsReview: boolean;
  signals: { key: "comprehension" | "reliance" | "policy"; points: number; max: number; reason: string; pending: boolean }[];
  paragraphs: { index: number; level: string; disclosed: boolean; note: string; opening: string }[];
  levers: { paragraph: number; level: string; scoreWithout: number; drop: number }[];
  scoreIfAllFixed: number;
};

type Rules = { uses?: Partial<Record<CardUse, UseStance>>; allowed: string[]; notAllowed: string[]; disclose: string };

// Sent as the transcript when a student clicks "No AI submission". The
// analysis recognizes it (noAiUsed) and scores without a model call.
const NO_AI_TRANSCRIPT = 'No AI used for this assignment (the student clicked "No AI submission").';

const SIGNAL_NAME = { comprehension: "Comprehension quiz", reliance: "AI reliance", policy: "Course AI rules" } as const;
const LEVEL_NAME: Record<string, string> = {
  ideas: "built on AI ideas",
  heavy: "closely follows AI wording",
  written: "written by AI",
};

type Submission = {
  id: number;
  assignmentText: string;
  transcript: string;
  result: Result | null;
  revisionsUsed: number;
  maxRevisions: number;
  quiz: Quiz | null;
  quizAnswers: string[] | null;
  studentResponse: string | null;
  reportCard: { comprehension?: { passed: boolean; note: string } } | null;
  status: string;
};

type Detail = {
  class: { id: number; name: string };
  rules: Rules | null;
  assignment: { id: number; title: string; instructions: string; open: boolean; quizOpen: boolean };
  submission: Submission | null;
};

const colors = {
  bg: "#F7F5F0",
  ink: "#1E2230",
  muted: "#6B7080",
  accent: "#8A5A3B",
  border: "#E7E2D8",
  cardBorder: "#D8D3C6",
  green: "#3F7A5E",
  amber: "#B8822F",
  amberBg: "#FBF0DA",
};

const inputStyle: React.CSSProperties = {
  border: `1px solid ${colors.cardBorder}`,
  borderRadius: 8,
  padding: "10px 12px",
  fontSize: 14,
  fontFamily: "inherit",
  width: "100%",
  resize: "vertical" as const,
};

// Keyed by assignment id: moving to another assignment starts from a clean
// page instead of carrying over the last one's state and timers.
export default function StudentAssignmentClient() {
  const params = useParams<{ id: string }>();
  return <AssignmentView key={params.id} id={params.id} />;
}

function AssignmentView({ id }: { id: string }) {
  const router = useRouter();
  const params = { id };
  const [detail, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [assignmentText, setAssignmentText] = useState("");
  const [transcript, setTranscript] = useState("");
  const [noAi, setNoAi] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [revising, setRevising] = useState(false);
  const [addedTranscript, setAddedTranscript] = useState("");

  const [answers, setAnswers] = useState<string[]>([]);
  const [savingAnswers, setSavingAnswers] = useState(false);

  const [response, setResponse] = useState("");
  const [savingResponse, setSavingResponse] = useState(false);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the page current without a manual reload: fast while the analysis
  // runs or the quiz is being prepared, slower while waiting for the teacher
  // to start the quiz, and again whenever the student comes back to the tab.
  const sub = detail?.submission;
  const quizOpen = detail?.assignment.quizOpen ?? false;
  const pollEvery =
    sub?.status === "analyzing" ? 3000
    : sub?.quiz && !sub.quizAnswers && quizOpen && sub.quiz.quiz.length === 0 ? 4000
    : sub?.quiz && !sub.quizAnswers && !quizOpen && !revising ? 20000
    : 0;
  useEffect(() => {
    if (!pollEvery) return;
    const t = setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, pollEvery);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pollEvery]);
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") void load();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function retryAnalysis() {
    setError(null);
    const res = await fetch(`/api/student/assignments/${params.id}/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ retry: true }),
    });
    const data = await res.json();
    if (!res.ok) return setError(data.error ?? "Couldn't retry.");
    setDetail((d) => (d ? { ...d, submission: data.submission } : d));
  }

  async function load() {
    const res = await fetch(`/api/student/assignments/${params.id}`);
    if (res.status === 401) {
      router.push("/student/login");
      return;
    }
    if (res.status === 403) {
      router.push("/student");
      return;
    }
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Something went wrong.");
      return;
    }
    setDetail(data);
    if (data.submission?.quiz?.quiz?.length) {
      const n = data.submission.quiz.quiz.length;
      setAnswers((prev) => data.submission.quizAnswers ?? (prev.length === n ? prev : Array(n).fill("")));
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/student/assignments/${params.id}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(revising ? { assignmentText, addedTranscript } : { assignmentText, transcript: noAi ? NO_AI_TRANSCRIPT : transcript }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not submit.");
        if (data.submission) setDetail((d) => (d ? { ...d, submission: data.submission } : d));
        return;
      }
      // Reload so the quiz stays hidden unless the teacher has activated it.
      const wasRevision = revising;
      setRevising(false);
      setAddedTranscript("");
      setDetail((d) => (d ? { ...d, submission: data.submission } : d));
      toast(wasRevision ? "Revision received. Analyzing it now." : "Submitted. Analyzing it now.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAnswers(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSavingAnswers(true);
    try {
      const res = await fetch(`/api/student/assignments/${params.id}/answer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not save your answers.");
        return;
      }
      setDetail((d) => (d ? { ...d, submission: data.submission } : d));
      toast("Answers submitted.");
    } finally {
      setSavingAnswers(false);
    }
  }

  async function handleRespond(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSavingResponse(true);
    try {
      const res = await fetch(`/api/student/assignments/${params.id}/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentResponse: response }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not save your response.");
        return;
      }
      setDetail((d) => (d ? { ...d, submission: data.submission } : d));
      toast("Response sent to your teacher.");
    } finally {
      setSavingResponse(false);
    }
  }

  if (!detail && !error) {
    return (
      <main style={{ minHeight: "calc(100vh - 57px)", background: colors.bg, padding: 48 }}>
        <div style={{ color: colors.muted, fontFamily: "var(--font-sans), sans-serif", display: "flex", gap: 8, alignItems: "center" }}>
          <Spinner />Loading...</div>
      </main>
    );
  }

  const submission = detail?.submission ?? null;

  return (
    <main
      style={{
        minHeight: "calc(100vh - 57px)",
        background: colors.bg,
        fontFamily: "var(--font-sans), system-ui, sans-serif",
        color: colors.ink,
        padding: "48px 32px 80px",
      }}
    >
      <div style={{ maxWidth: 680, margin: "0 auto", display: "flex", flexDirection: "column", gap: 20 }}>
        <div>
          <Link
            href={detail ? `/student/classes/${detail.class.id}` : "/student"}
            style={{ fontSize: 13, color: colors.muted, textDecoration: "none" }}
          >
            ← Back to {detail?.class.name ?? "your classes"}
          </Link>
          <div
            style={{
              fontSize: 13,
              fontWeight: 600,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: colors.accent,
              marginTop: 10,
            }}
          >
            Student · Assignment
          </div>
          <h1 style={{ margin: "4px 0 0", fontSize: 26, fontWeight: 600 }}>{detail?.assignment.title}</h1>
          {detail?.assignment.instructions && (
            <p style={{ margin: "6px 0 0", fontSize: 14, color: colors.muted }}>{detail.assignment.instructions}</p>
          )}
        </div>

        {error && <div style={{ color: colors.amber, fontSize: 14 }}>{error}</div>}

        {/* No submission yet */}
        {!submission && detail && !detail.assignment.open && (
          <div
            style={{
              background: "#EFEDE6",
              color: colors.muted,
              borderRadius: 10,
              padding: "16px 18px",
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            This assignment isn&apos;t open for submissions yet.
          </div>
        )}

        {detail?.rules && (!submission || revising) && detail.assignment.open && <RulesCard rules={detail.rules} />}

        {(!submission || revising) && detail?.assignment.open && (
          <form
            onSubmit={handleSubmit}
            style={{
              background: "#fff",
              border: `1px solid ${colors.border}`,
              borderRadius: 10,
              padding: "20px 22px",
              display: "flex",
              flexDirection: "column",
              gap: 14,
            }}
          >
            <p style={{ margin: 0, fontSize: 13, color: colors.muted }}>
              {revising
                ? (() => {
                    const left = submission ? submission.maxRevisions - submission.revisionsUsed - 1 : 0;
                    return `Replace your assignment and add any new AI chat. Your teacher sees every version. ${left === 0 ? (submission && submission.maxRevisions === 1 ? "You get one resubmission, so this is it." : "This is your last revision.") : `${left} more revision${left === 1 ? "" : "s"} after this one.`}`;
                  })()
                : "Paste your work and your AI conversation (if you used one). You'll see your score right after you submit, and you can resubmit once before the quiz starts."}
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={{ fontSize: 13, fontWeight: 600 }}>Your assignment</label>
              <textarea
                required
                rows={8}
                value={assignmentText}
                onChange={(e) => setAssignmentText(e.target.value)}
                placeholder="Paste your submission text here..."
                style={inputStyle}
              />
            </div>
            {revising ? (
              <>
                <details style={{ fontSize: 13 }}>
                  <summary style={{ cursor: "pointer", fontWeight: 600 }}>
                    Your AI conversation so far (locked, can&apos;t be edited or removed)
                  </summary>
                  <pre style={{ whiteSpace: "pre-wrap", fontFamily: "inherit", background: "#F3F1EC", borderRadius: 8, padding: "10px 12px", maxHeight: 240, overflow: "auto", margin: "6px 0 0" }}>
                    {submission?.transcript}
                  </pre>
                </details>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <label htmlFor="added-transcript" style={{ fontSize: 13, fontWeight: 600 }}>
                    Add another AI conversation <span style={{ fontWeight: 400, color: colors.muted }}>(optional, if you used AI while revising)</span>
                  </label>
                  <textarea
                    id="added-transcript"
                    rows={6}
                    value={addedTranscript}
                    onChange={(e) => setAddedTranscript(e.target.value)}
                    placeholder="Paste any new AI chat here. It's added after your original conversation."
                    style={inputStyle}
                  />
                </div>
              </>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                  <label htmlFor="transcript" style={{ fontSize: 13, fontWeight: 600 }}>AI conversation transcript</label>
                  <button
                    type="button"
                    aria-pressed={noAi}
                    onClick={() => setNoAi((v) => !v)}
                    style={{
                      background: noAi ? colors.ink : "#fff",
                      color: noAi ? "#fff" : colors.ink,
                      border: `1px solid ${noAi ? colors.ink : colors.cardBorder}`,
                      borderRadius: 8,
                      padding: "6px 12px",
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    {noAi ? "✓ No AI submission" : "No AI submission"}
                  </button>
                </div>
                {noAi ? (
                  <p style={{ margin: 0, fontSize: 13, color: colors.muted, background: "#F3F1EC", borderRadius: 8, padding: "10px 12px" }}>
                    You&apos;re submitting without an AI conversation, which tells your teacher you didn&apos;t use AI for this
                    assignment. If you used any AI tool, click the button again and paste the chat.
                  </p>
                ) : (
                  <textarea
                    id="transcript"
                    required
                    rows={10}
                    value={transcript}
                    onChange={(e) => setTranscript(e.target.value)}
                    placeholder="Paste your full AI chat here. Didn't use AI? Click “No AI submission”."
                    style={inputStyle}
                  />
                )}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              style={{
                background: colors.ink,
                color: "#fff",
                border: "none",
                borderRadius: 8,
                padding: "11px 18px",
                fontSize: 14,
                fontWeight: 600,
                cursor: submitting ? "default" : "pointer",
                opacity: submitting ? 0.6 : 1,
                alignSelf: "flex-start",
              }}
            >
              {submitting && <Spinner />} {submitting ? "Submitting…" : revising ? "Resubmit" : "Submit"}
            </button>
            {revising && (
              <button type="button" onClick={() => setRevising(false)} style={{ background: "none", border: "none", color: colors.muted, fontSize: 13, cursor: "pointer", alignSelf: "flex-start", padding: 0 }}>
                Cancel, keep my current submission
              </button>
            )}
          </form>
        )}

        {submission?.status === "analyzing" && !revising && (
          <AnalyzingCard />
        )}

        {submission?.status === "analysis_failed" && !revising && (
          <div style={{ background: colors.amberBg, border: `1px solid ${colors.amber}`, borderRadius: 10, padding: "16px 18px", fontSize: 14, display: "flex", flexDirection: "column", gap: 10 }}>
            <span>The analysis didn&apos;t finish. Your work is saved. Trying again doesn&apos;t use a revision.</span>
            <button type="button" onClick={() => void retryAnalysis()} style={{ alignSelf: "flex-start", background: colors.ink, color: "#fff", border: "none", borderRadius: 8, padding: "9px 14px", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
              Try again
            </button>
          </div>
        )}

        {submission?.result && !revising && submission.status !== "analyzing" && (
          <ResultPanel
            result={submission.result}
            canRevise={
              !!detail?.assignment.open &&
              !detail.assignment.quizOpen &&
              !submission.quizAnswers &&
              submission.revisionsUsed < submission.maxRevisions
            }
            revisionsLeft={submission.maxRevisions - submission.revisionsUsed}
            onRevise={() => {
              setAssignmentText(submission.assignmentText);
              setAddedTranscript("");
              setRevising(true);
            }}
          />
        )}

        {/* Submitted, quiz not activated by the teacher yet */}
        {submission && !revising && submission.quiz && !submission.quizAnswers && !detail?.assignment.quizOpen && (
          <div
            style={{
              background: "#EFEDE6",
              color: colors.ink,
              borderRadius: 10,
              padding: "16px 18px",
              fontSize: 14,
            }}
          >
            <strong>Next:</strong> your teacher will start a 2-question quiz (one sentence each). Come back here when
            they do.
          </div>
        )}

        {submission && submission.quiz && !submission.quizAnswers && detail?.assignment.quizOpen && submission.quiz.quiz.length === 0 && (
          <div style={{ background: "#fff", border: `1px solid ${colors.border}`, borderRadius: 10, padding: "16px 18px", display: "flex", flexDirection: "column", gap: 10 }}>
            <WorkingNote message="Preparing your quiz…" hint="This takes a few seconds." />
            <button type="button" onClick={() => void load()} style={{ alignSelf: "flex-start", background: colors.ink, color: "#fff", border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
              Check again
            </button>
          </div>
        )}

        {/* Quiz active, not yet answered */}
        {submission && submission.quiz && !submission.quizAnswers && detail?.assignment.quizOpen && (
          (submission.quiz.quiz.length > 0 && (
          <form
            onSubmit={handleAnswers}
            style={{
              background: "#fff",
              border: `1px solid ${colors.border}`,
              borderRadius: 10,
              padding: "20px 22px",
              display: "flex",
              flexDirection: "column",
              gap: 16,
            }}
          >
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 4px" }}>Quick comprehension check</h2>
              <p style={{ margin: 0, fontSize: 13, color: colors.muted }}>
                Answer in your own words — this is about the parts of the work you said you did yourself.
              </p>
            </div>
            {submission.quiz.quiz.map((q, i) => (
              <div key={i} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label style={{ fontSize: 13, fontWeight: 600 }}>
                  {i + 1}. {q.question}{" "}
                  <span style={{ fontWeight: 400, color: colors.muted }}>
                    ({q.expected_length === "two_sentences" ? "answer in two sentences" : "answer in one sentence"})
                  </span>
                </label>
                <textarea
                  required
                  rows={q.expected_length === "two_sentences" ? 2 : 1}
                  value={answers[i] ?? ""}
                  onChange={(e) =>
                    setAnswers((prev) => {
                      const next = [...prev];
                      next[i] = e.target.value;
                      return next;
                    })
                  }
                  style={inputStyle}
                />
              </div>
            ))}
            {savingAnswers && <WorkingNote message="Checking your answers…" hint="About 10–20 seconds." />}
            <button
              type="submit"
              disabled={savingAnswers}
              style={{
                background: colors.ink,
                color: "#fff",
                border: "none",
                borderRadius: 8,
                padding: "11px 18px",
                fontSize: 14,
                fontWeight: 600,
                cursor: savingAnswers ? "default" : "pointer",
                opacity: savingAnswers ? 0.6 : 1,
                alignSelf: "flex-start",
              }}
            >
              {savingAnswers && <Spinner />} {savingAnswers ? "Saving…" : "Submit answers"}
            </button>
          </form>
          ))
        )}

        {/* Answered, flagged, needs student response before teacher sees it */}
        {submission && submission.quizAnswers && submission.status === "flagged" && !submission.studentResponse && (
          <form
            onSubmit={handleRespond}
            style={{
              background: colors.amberBg,
              border: `1px solid ${colors.amber}`,
              borderRadius: 10,
              padding: "20px 22px",
              display: "flex",
              flexDirection: "column",
              gap: 12,
            }}
          >
            <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: colors.amber }}>
              One thing worth clarifying
            </h2>
            {submission.quiz?.policy_concern && (
              <p style={{ margin: 0, fontSize: 13, color: colors.ink }}>
                <strong>About your AI use:</strong> {submission.quiz.policy_concern}
              </p>
            )}
            {submission.reportCard?.comprehension && !submission.reportCard.comprehension.passed && (
              <p style={{ margin: 0, fontSize: 13, color: colors.ink }}>
                <strong>About your quiz answers:</strong> {submission.reportCard.comprehension.note}
              </p>
            )}
            <p style={{ margin: 0, fontSize: 13, color: colors.muted }}>
              Add context before your teacher reviews this — it&apos;ll be shown alongside your submission.
            </p>
            <textarea
              required
              rows={4}
              value={response}
              onChange={(e) => setResponse(e.target.value)}
              placeholder="Explain what happened here..."
              style={inputStyle}
            />
            <button
              type="submit"
              disabled={savingResponse}
              style={{
                background: colors.ink,
                color: "#fff",
                border: "none",
                borderRadius: 8,
                padding: "11px 18px",
                fontSize: 14,
                fontWeight: 600,
                cursor: savingResponse ? "default" : "pointer",
                opacity: savingResponse ? 0.6 : 1,
                alignSelf: "flex-start",
              }}
            >
              {savingResponse && <Spinner />} {savingResponse ? "Saving…" : "Send response"}
            </button>
          </form>
        )}

        {/* Fully done */}
        {submission &&
          submission.quizAnswers &&
          (submission.status !== "flagged" || submission.studentResponse) && (
            <div
              style={{
                background: "#E7F1EB",
                color: colors.green,
                borderRadius: 10,
                padding: "16px 18px",
                fontSize: 14,
                fontWeight: 600,
              }}
            >
              {submission.status === "flagged"
                ? "Submitted — your response has been added and your teacher will review it."
                : "Submitted — your teacher will review when ready."}
            </div>
          )}
      </div>
    </main>
  );
}

const box: React.CSSProperties = {
  background: "#fff",
  border: `1px solid ${colors.border}`,
  borderRadius: 10,
  padding: "16px 20px",
  display: "flex",
  flexDirection: "column",
  gap: 10,
};
const smallHead: React.CSSProperties = { fontSize: 12, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: colors.muted, margin: 0 };

function RulesCard({ rules }: { rules: Rules }) {
  return (
    <section aria-label="AI rules for this assignment" style={box}>
      <h2 style={{ ...smallHead, color: colors.accent }}>AI rules for this assignment</h2>
      {rules.uses && Object.keys(rules.uses).length > 0 ? (
        <UsesGrid uses={rules.uses} />
      ) : (
        <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: colors.green, marginBottom: 4 }}>You can use AI for</div>
          {rules.allowed.length ? (
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 14, lineHeight: 1.5 }}>{rules.allowed.map((r) => <li key={r}>{r}</li>)}</ul>
          ) : (
            <div style={{ fontSize: 14, color: colors.muted }}>Nothing listed. Ask your teacher before using AI.</div>
          )}
        </div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: colors.amber, marginBottom: 4 }}>Not allowed</div>
          {rules.notAllowed.length ? (
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 14, lineHeight: 1.5 }}>{rules.notAllowed.map((r) => <li key={r}>{r}</li>)}</ul>
          ) : (
            <div style={{ fontSize: 14, color: colors.muted }}>Nothing listed.</div>
          )}
        </div>
      </div>
        </>
      )}
      {rules.disclose && (
        <p style={{ margin: 0, fontSize: 14 }}>
          <strong>Disclosing AI use:</strong> {rules.disclose}
        </p>
      )}
    </section>
  );
}

function ResultPanel({
  result,
  canRevise,
  revisionsLeft,
  onRevise,
}: {
  result: Result;
  canRevise: boolean;
  revisionsLeft: number;
  onRevise: () => void;
}) {
  const over = result.score >= result.threshold || result.needsReview;
  const quizPending = result.signals.some((s) => s.key === "comprehension" && s.pending);
  return (
    <section aria-label="Your result" style={{ ...box, borderColor: over ? colors.amber : colors.border }}>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: "4px 14px" }}>
        <span style={{ fontSize: 32, fontWeight: 700, fontVariantNumeric: "tabular-nums", color: over ? colors.amber : colors.ink }}>
          {result.score}
          <span style={{ fontSize: 16, fontWeight: 500, color: colors.muted }}> / 100</span>
        </span>
        <span style={{ fontSize: 14, color: colors.muted }}>
          follow-up priority. Your teacher reviews anything at {result.threshold} or above
          {quizPending ? "; the quiz can still add up to 45 points." : "."}
        </span>
      </div>
      <p style={{ margin: 0, fontSize: 13, color: colors.muted }}>
        This isn&apos;t a grade and doesn&apos;t mean you did anything wrong. It decides whether your teacher takes a
        closer look.
      </p>

      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
        <tbody>
          {result.signals.map((s) => (
            <tr key={s.key} style={{ borderTop: `1px solid ${colors.border}` }}>
              <td style={{ padding: "7px 0", fontWeight: 600, whiteSpace: "nowrap", verticalAlign: "top" }}>{SIGNAL_NAME[s.key]}</td>
              <td style={{ padding: "7px 12px", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap", verticalAlign: "top" }}>
                {s.pending ? `– / ${s.max}` : `${s.points} / ${s.max}`}
              </td>
              <td style={{ padding: "7px 0", color: colors.muted, verticalAlign: "top" }}>
                {s.pending ? "After the quiz." : s.reason || "Nothing to note."}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {result.paragraphs.length > 0 && (
        <div>
          <h3 style={smallHead}>Paragraphs that lean on AI</h3>
          {result.paragraphs.map((p) => (
            <div key={p.index} style={{ fontSize: 14, padding: "6px 0", borderTop: `1px solid ${colors.border}` }}>
              <strong>¶{p.index}</strong> <span style={{ color: colors.muted }}>&ldquo;{p.opening}…&rdquo;</span>
              <div>
                {LEVEL_NAME[p.level] ?? p.level}
                {p.disclosed ? " · disclosed, not counted" : ""}
                {p.note ? <span style={{ color: colors.muted }}> · {p.note}</span> : null}
              </div>
            </div>
          ))}
        </div>
      )}

      {result.levers.length > 0 && (
        <div>
          <h3 style={smallHead}>What would change your score</h3>
          {result.levers.map((l) => (
            <div key={l.paragraph} style={{ fontSize: 14, padding: "5px 0" }}>
              ¶{l.paragraph} in your own words, or disclosed if the rules allow that help:{" "}
              <strong style={{ fontVariantNumeric: "tabular-nums" }}>
                {result.score} → {l.scoreWithout}
              </strong>
            </div>
          ))}
          {result.levers.length > 1 && (
            <div style={{ fontSize: 14, padding: "5px 0", color: colors.muted }}>
              All of them: {result.score} → {result.scoreIfAllFixed}
            </div>
          )}
        </div>
      )}

      {canRevise ? (
        <button
          type="button"
          onClick={onRevise}
          style={{ alignSelf: "flex-start", background: colors.ink, color: "#fff", border: "none", borderRadius: 8, padding: "10px 16px", fontSize: 14, fontWeight: 600, cursor: "pointer" }}
        >
          {revisionsLeft === 1 ? "Resubmit once" : `Revise and resubmit (${revisionsLeft} left)`}
        </button>
      ) : (
        revisionsLeft <= 0 && <div style={{ fontSize: 13, color: colors.muted }}>You&rsquo;ve used your resubmission.</div>
      )}
    </section>
  );
}
