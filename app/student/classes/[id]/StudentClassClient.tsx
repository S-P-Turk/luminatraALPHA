"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Spinner } from "@/src/components/Spinner";

type AssignmentRow = {
  id: number;
  title: string;
  open: boolean;
  quizOpen: boolean;
  submission: {
    id: number;
    status: string;
    hasQuiz: boolean;
    hasAnswers: boolean;
    hasResponded: boolean;
  } | null;
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

function statusLabel(a: AssignmentRow): { text: string; bg: string; fg: string } {
  if (!a.submission) {
    return a.open
      ? { text: "Open — not submitted", bg: colors.amberBg, fg: colors.amber }
      : { text: "Not open yet", bg: "#EFEDE6", fg: colors.muted };
  }
  if (a.submission.hasQuiz && !a.submission.hasAnswers) {
    return a.quizOpen
      ? { text: "Quiz ready — answer it", bg: colors.amberBg, fg: colors.amber }
      : { text: "Submitted — quiz not started", bg: "#EFEDE6", fg: colors.muted };
  }
  if (a.submission.status === "flagged" && !a.submission.hasResponded) {
    return { text: "Needs your response", bg: colors.amberBg, fg: colors.amber };
  }
  if (a.submission.status === "flagged") {
    return { text: "Flagged — awaiting teacher", bg: colors.amberBg, fg: colors.amber };
  }
  if (!a.submission.hasAnswers) {
    return { text: "Quiz ready — answer it", bg: colors.amberBg, fg: colors.amber };
  }
  return { text: "Submitted", bg: "#E7F1EB", fg: colors.green };
}

export default function StudentClassClient() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const [className, setClassName] = useState<string | null>(null);
  const [assignments, setAssignments] = useState<AssignmentRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  async function load() {
    const res = await fetch(`/api/student/classes/${params.id}`);
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
    setClassName(data.class.name);
    setAssignments(data.assignments);
  }

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
          <Link href="/student" style={{ fontSize: 13, color: colors.muted, textDecoration: "none" }}>
            ← Back to your classes
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
            Student · Class
          </div>
          <h1 style={{ margin: "4px 0 0", fontSize: 26, fontWeight: 600 }}>{className}</h1>
        </div>

        {error && <div style={{ color: colors.amber, fontSize: 14 }}>{error}</div>}

        {assignments === null && !error && (
          <div style={{ color: colors.muted, fontSize: 14 }}><Spinner /> Loading…</div>
        )}

        {assignments?.length === 0 && (
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
            Your teacher hasn&apos;t posted any assignments for this class yet.
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {assignments?.map((a) => {
            const label = statusLabel(a);
            return (
              <Link
                key={a.id}
                href={`/student/assignments/${a.id}`}
                style={{
                  background: "#fff",
                  border: `1px solid ${colors.border}`,
                  borderRadius: 10,
                  padding: "16px 20px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 16,
                  textDecoration: "none",
                  color: colors.ink,
                }}
              >
                <div style={{ fontSize: 16, fontWeight: 600 }}>{a.title}</div>
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    padding: "4px 10px",
                    borderRadius: 999,
                    background: label.bg,
                    color: label.fg,
                    whiteSpace: "nowrap",
                  }}
                >
                  {label.text}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </main>
  );
}
