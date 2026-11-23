"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

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

type Submission = {
  id: number;
  quiz: Quiz | null;
  quizAnswers: string[] | null;
  studentResponse: string | null;
  status: string;
};

type Detail = {
  class: { id: number; name: string };
  assignment: { id: number; title: string; instructions: string; open: boolean };
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

export default function StudentAssignmentClient() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const [detail, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [assignmentText, setAssignmentText] = useState("");
  const [transcript, setTranscript] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [answers, setAnswers] = useState<string[]>([]);
  const [savingAnswers, setSavingAnswers] = useState(false);

  const [response, setResponse] = useState("");
  const [savingResponse, setSavingResponse] = useState(false);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

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
    if (data.submission?.quiz?.quiz) {
      setAnswers(data.submission.quizAnswers ?? data.submission.quiz.quiz.map(() => ""));
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
        body: JSON.stringify({ assignmentText, transcript }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not submit.");
        if (data.submission) setDetail((d) => (d ? { ...d, submission: data.submission } : d));
        return;
      }
      setDetail((d) => (d ? { ...d, submission: data.submission } : d));
      setAnswers(data.submission.quiz?.quiz?.map(() => "") ?? []);
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
    } finally {
      setSavingResponse(false);
    }
  }

  if (!detail && !error) {
    return (
      <main style={{ minHeight: "100vh", background: colors.bg, padding: 48 }}>
        <div style={{ color: colors.muted, fontFamily: "Inter, sans-serif" }}>Loading...</div>
      </main>
    );
  }

  const submission = detail?.submission ?? null;

  return (
    <main
      style={{
        minHeight: "100vh",
        background: colors.bg,
        fontFamily: "Inter, system-ui, sans-serif",
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
            Luminatra
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

        {!submission && detail?.assignment.open && (
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
              Paste your submission and your AI conversation transcript (if you used one). A short comprehension
              quiz will be generated from this.
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
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={{ fontSize: 13, fontWeight: 600 }}>AI conversation transcript</label>
              <textarea
                required
                rows={10}
                value={transcript}
                onChange={(e) => setTranscript(e.target.value)}
                placeholder="Paste your AI chat transcript, or write 'I did not use AI for this assignment.'"
                style={inputStyle}
              />
            </div>
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
              {submitting ? "Generating your quiz..." : "Submit"}
            </button>
          </form>
        )}

        {/* Quiz generated, not yet answered */}
        {submission && submission.quiz && !submission.quizAnswers && (
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
              {savingAnswers ? "Saving..." : "Submit answers"}
            </button>
          </form>
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
            <p style={{ margin: 0, fontSize: 13, color: colors.ink }}>
              {submission.quiz?.policy_concern}
            </p>
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
              {savingResponse ? "Saving..." : "Send response"}
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
