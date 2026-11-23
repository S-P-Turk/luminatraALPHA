"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

type QuizQuestion = { question: string; what_it_tests: string };
type Quiz = {
  policy_summary: string;
  policy_concern: string | null;
  claimed_unassisted_areas: string[];
  quiz: QuizQuestion[];
};

type Submission = {
  id: number;
  assignmentId: number;
  assignmentTitle: string;
  studentName: string;
  studentEmail: string;
  quiz: Quiz | null;
  quizAnswers: string[] | null;
  reportCard: unknown;
  studentResponse: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
};

type ClassInfo = { id: number; name: string; joinCode: string | null };

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

function statusBadge(status: string) {
  if (status === "flagged") {
    return { label: "Needs review", bg: colors.amberBg, fg: colors.amber };
  }
  if (status === "cleared") {
    return { label: "Cleared", bg: "#E7F1EB", fg: colors.green };
  }
  return { label: "Submitted", bg: "#EFEDE6", fg: colors.muted };
}

export default function SubmissionsClient() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const [cls, setCls] = useState<ClassInfo | null>(null);
  const [submissions, setSubmissions] = useState<Submission[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  async function load() {
    const res = await fetch(`/api/classes/${params.id}/submissions`);
    if (res.status === 401) {
      router.push("/login");
      return;
    }
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Failed to load submissions.");
      return;
    }
    setCls(data.class);
    setSubmissions(data.submissions);
  }

  async function dismissSubmission(id: number) {
    const res = await fetch(`/api/classes/${params.id}/submissions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "cleared" }),
    });
    if (!res.ok) return;
    const data = await res.json();
    setSubmissions((prev) =>
      prev ? prev.map((s) => (s.id === id ? { ...s, status: data.submission.status } : s)) : prev
    );
  }

  const flagged = submissions?.filter((s) => s.status === "flagged") ?? [];
  const rest = submissions?.filter((s) => s.status !== "flagged") ?? [];

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
      <div style={{ maxWidth: 820, margin: "0 auto", display: "flex", flexDirection: "column", gap: 20 }}>
        <div>
          <Link href="/classes" style={{ fontSize: 13, color: colors.muted, textDecoration: "none" }}>
            ← Back to classes
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
          <h1 style={{ margin: "4px 0 0", fontSize: 26, fontWeight: 600 }}>
            {cls ? `${cls.name} — submissions` : "Submissions"}
          </h1>
        </div>

        {error && <div style={{ color: colors.amber, fontSize: 14 }}>{error}</div>}

        {submissions === null && !error && (
          <div style={{ color: colors.muted, fontSize: 14 }}>Loading...</div>
        )}

        {submissions?.length === 0 && (
          <div
            style={{
              background: "#fff",
              border: `1px solid ${colors.border}`,
              borderRadius: 10,
              padding: 32,
              textAlign: "center",
              color: colors.muted,
              fontSize: 14,
            }}
          >
            No submissions yet. Once students submit their work and transcript, flagged ones will show up here
            first.
          </div>
        )}

        {submissions && submissions.length > 0 && (
          <>
            <div>
              <h2 style={{ fontSize: 15, fontWeight: 700, margin: "0 0 10px" }}>
                Needs review {flagged.length > 0 ? `(${flagged.length})` : ""}
              </h2>
              {flagged.length === 0 ? (
                <div style={{ color: colors.muted, fontSize: 13 }}>
                  Nothing flagged right now — every submission checked out clean.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {flagged.map((s) => (
                    <SubmissionRow key={s.id} s={s} onDismiss={dismissSubmission} />
                  ))}
                </div>
              )}
            </div>

            {rest.length > 0 && (
              <div>
                <button
                  onClick={() => setShowAll((v) => !v)}
                  style={{
                    background: "none",
                    border: "none",
                    padding: 0,
                    color: colors.muted,
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                    marginBottom: showAll ? 10 : 0,
                  }}
                >
                  {showAll ? "Hide" : "Show"} {rest.length} other submission{rest.length === 1 ? "" : "s"} ▾
                </button>
                {showAll && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {rest.map((s) => (
                      <SubmissionRow key={s.id} s={s} onDismiss={dismissSubmission} />
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}

function SubmissionRow({ s, onDismiss }: { s: Submission; onDismiss: (id: number) => void }) {
  const badge = statusBadge(s.status);
  const [open, setOpen] = useState(false);

  return (
    <div
      style={{
        background: "#fff",
        border: `1px solid ${colors.border}`,
        borderRadius: 10,
        padding: "14px 18px",
      }}
    >
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          background: "none",
          border: "none",
          padding: 0,
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          flexWrap: "wrap",
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        <div>
          <div style={{ fontSize: 15, fontWeight: 600, color: colors.ink }}>{s.studentName}</div>
          <div style={{ fontSize: 12, color: colors.muted }}>{s.studentEmail}</div>
          <div style={{ fontSize: 12, color: colors.accent, fontWeight: 600, marginTop: 2 }}>{s.assignmentTitle}</div>
          <div style={{ fontSize: 11, color: colors.muted, marginTop: 2 }}>
            {new Date(s.createdAt).toLocaleString()}
          </div>
        </div>
        <span
          style={{
            fontSize: 12,
            fontWeight: 600,
            padding: "4px 10px",
            borderRadius: 999,
            background: badge.bg,
            color: badge.fg,
          }}
        >
          {badge.label}
        </span>
      </button>

      {open && (
        <div
          style={{
            marginTop: 14,
            paddingTop: 14,
            borderTop: `1px solid ${colors.border}`,
            display: "flex",
            flexDirection: "column",
            gap: 12,
            fontSize: 13,
          }}
        >
          {s.quiz?.policy_concern && (
            <div>
              <div style={{ fontWeight: 700, color: colors.amber, marginBottom: 2 }}>Policy concern</div>
              <div style={{ color: colors.ink }}>{s.quiz.policy_concern}</div>
            </div>
          )}
          {s.quiz?.policy_summary && (
            <div>
              <div style={{ fontWeight: 700, marginBottom: 2 }}>Policy summary</div>
              <div style={{ color: colors.muted }}>{s.quiz.policy_summary}</div>
            </div>
          )}
          {s.studentResponse && (
            <div>
              <div style={{ fontWeight: 700, marginBottom: 2 }}>Student&apos;s response</div>
              <div style={{ color: colors.ink }}>{s.studentResponse}</div>
            </div>
          )}
          {s.quiz?.quiz && s.quiz.quiz.length > 0 && (
            <div>
              <div style={{ fontWeight: 700, marginBottom: 6 }}>Comprehension check</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {s.quiz.quiz.map((q, i) => (
                  <div key={i}>
                    <div style={{ fontWeight: 600 }}>{q.question}</div>
                    <div style={{ color: colors.muted, marginTop: 2 }}>
                      {s.quizAnswers?.[i] ? s.quizAnswers[i] : <em>Not answered yet.</em>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {s.status === "flagged" && (
            <button
              onClick={() => onDismiss(s.id)}
              style={{
                background: colors.ink,
                color: "#fff",
                border: "none",
                borderRadius: 6,
                padding: "7px 14px",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                alignSelf: "flex-start",
              }}
            >
              Dismiss — mark cleared
            </button>
          )}
        </div>
      )}
    </div>
  );
}
