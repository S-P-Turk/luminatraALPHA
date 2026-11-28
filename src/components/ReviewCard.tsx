"use client";

import { useState } from "react";
import { scoreLevers, type ScoreCard } from "@/src/lib/scoring";
import { ContributionMapView } from "./ContributionMapView";
import { toast } from "./Toaster";

export const SIGNAL_LABELS = {
  comprehension: "Comprehension check",
  reliance: "AI reliance",
  policy: "Syllabus AI rules",
} as const;

export function scoreOf(s: { reportCard?: { scoreCard?: ScoreCard } | null }): number | null {
  return s.reportCard?.scoreCard?.score ?? null;
}

// One compact review card, shared by the per-class submissions page and the
// all-classes /review page so the teacher sees the same thing everywhere.

export type ReviewQuiz = {
  policy_summary: string;
  policy_concern: string | null;
  quiz: { question: string; answer_key?: string }[];
};

export type ReviewSubmission = {
  id: number;
  classId: number;
  className?: string;
  assignmentTitle: string;
  studentName: string;
  studentEmail: string;
  assignmentText?: string;
  quiz: ReviewQuiz | null;
  quizAnswers: string[] | null;
  studentResponse: string | null;
  reportCard?: {
    comprehension?: { passed: boolean; note: string; per_question?: { adequate: boolean; reason: string }[] };
    scoreCard?: ScoreCard;
  } | null;
  status: string;
  createdAt: string;
  revisions?: { at: string; score: number | null }[] | null;
};

// The separate reasons a submission can be flagged, in display order. Flags
// are never verdicts — each one only suggests a follow-up for the teacher.
export function flagReasons(s: ReviewSubmission): { label: string; text: string }[] {
  const out: { label: string; text: string }[] = [];
  if (s.quiz?.policy_concern) out.push({ label: "Follow up on AI use", text: s.quiz.policy_concern });
  const c = s.reportCard?.comprehension;
  if (c && !c.passed) out.push({ label: "Follow up on comprehension", text: c.note });
  return out;
}

export const colors = {
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

function badgeFor(status: string) {
  if (status === "flagged") return { label: "Needs review", bg: colors.amberBg, fg: colors.amber };
  if (status === "cleared") return { label: "Cleared", bg: "#E7F1EB", fg: colors.green };
  if (status === "follow_up") return { label: "Following up", bg: "#E8ECF5", fg: "#3B5A8A" };
  if (status === "analyzing") return { label: "Analyzing", bg: "#EFEDE6", fg: colors.muted };
  if (status === "analysis_failed") return { label: "Analysis failed", bg: "#EFEDE6", fg: colors.muted };
  return { label: "Clean", bg: "#EFEDE6", fg: colors.muted };
}

export async function decideSubmission(
  s: ReviewSubmission,
  status: "cleared" | "follow_up"
): Promise<string | null> {
  const res = await fetch(`/api/classes/${s.classId}/submissions/${s.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.submission?.status ?? "cleared";
}

const quickBtn: React.CSSProperties = {
  background: "#fff",
  color: colors.ink,
  border: `1px solid ${colors.cardBorder}`,
  borderRadius: 6,
  padding: "4px 12px",
  fontSize: 12,
  fontWeight: 600,
  cursor: "pointer",
};

export function ReviewCard({
  s,
  onCleared,
}: {
  s: ReviewSubmission;
  onCleared: (id: number, status: string) => void;
}) {
  const badge = badgeFor(s.status);
  const [open, setOpen] = useState(false);
  const [showRule, setShowRule] = useState(false);
  const [busy, setBusy] = useState(false);
  const card = s.reportCard?.scoreCard;

  const questions = s.quiz?.quiz ?? [];
  const answered = questions.length > 0 && questions.every((_, i) => s.quizAnswers?.[i]);
  const reasons = flagReasons(s);
  const comprehension = s.reportCard?.comprehension;

  async function decide(next: "cleared" | "follow_up") {
    setBusy(true);
    const status = await decideSubmission(s, next);
    setBusy(false);
    if (status) {
      onCleared(s.id, status);
      toast(next === "cleared" ? `${s.studentName}: marked cleared.` : `${s.studentName}: marked for follow-up.`);
    } else {
      toast("Couldn't save that decision. Try again.", "error");
    }
  }

  return (
    <div style={{ background: "#fff", border: `1px solid ${colors.border}`, borderRadius: 10, padding: "12px 16px" }}>
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
          flexWrap: "wrap",
          gap: 12,
          cursor: "pointer",
          textAlign: "left",
          color: colors.ink,
        }}
      >
        <div style={{ minWidth: 0, flex: "1 1 280px" }}>
          <div style={{ fontSize: 15, fontWeight: 600 }}>{s.studentName}</div>
          <div style={{ fontSize: 12, color: colors.muted, marginTop: 2 }}>
            {s.className ? `${s.className} · ` : ""}
            {s.assignmentTitle} · {new Date(s.createdAt).toLocaleDateString()}
          </div>
          {!open && s.status === "flagged" &&
            (card
              ? (Object.keys(SIGNAL_LABELS) as (keyof typeof SIGNAL_LABELS)[])
                  .filter((k) => card.signals[k].points > 0 && card.signals[k].reason)
                  .map((k) => ({ label: SIGNAL_LABELS[k], text: card.signals[k].reason.replace(/^AI reliance (\d+%):/, "$1 of the work:") }))
              : reasons
            ).map((f) => (
              <div key={f.label} style={{ fontSize: 13, color: colors.amber, marginTop: 4 }}>
                <strong>{f.label}:</strong> {f.text}
              </div>
            ))}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          {card && (
            <span
              title="Follow-up priority: how strongly the signals suggest a closer look. Not a probability of cheating."
              style={{ textAlign: "right", lineHeight: 1.1 }}
            >
              <span style={{ fontSize: 18, fontWeight: 700, color: card.needsReview ? colors.amber : colors.muted }}>
                {card.score}
              </span>
              <span style={{ display: "block", fontSize: 10, color: colors.muted }}>follow-up priority</span>
            </span>
          )}
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
        </div>
      </button>

      {(s.revisions?.length ?? 0) > 0 && (
        <div style={{ fontSize: 12, color: colors.muted, marginTop: 6 }}>
          Revised {s.revisions!.length}× after seeing the score
          {s.revisions!.some((r) => (r as { addedChat?: boolean }).addedChat) ? " (added AI chat)" : ""}:{" "}
          {s.revisions!.map((r) => (r.score == null ? "–" : r.score)).join(" → ")} → {card?.score ?? "–"}
        </div>
      )}

      {!open && s.status === "flagged" && (
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <button onClick={() => decide("cleared")} disabled={busy} style={quickBtn}>Clear</button>
          <button onClick={() => decide("follow_up")} disabled={busy} style={quickBtn}>Follow up</button>
          <button onClick={() => setOpen(true)} style={{ ...quickBtn, border: "none", color: colors.accent }}>Details</button>
        </div>
      )}

      {open && (
        <div
          style={{
            marginTop: 12,
            paddingTop: 12,
            borderTop: `1px solid ${colors.border}`,
            display: "flex",
            flexDirection: "column",
            gap: 12,
            fontSize: 13,
          }}
        >
          {card ? (
            <div style={{ border: `1px solid ${colors.border}`, borderRadius: 8, padding: "10px 12px" }}>
              <div style={{ fontWeight: 700, marginBottom: 6 }}>
                Follow-up priority {card.score}/100{" "}
                <span style={{ fontWeight: 400, color: colors.muted }}>
                  — suggests where to look; you decide.
                </span>
              </div>
              {(Object.keys(SIGNAL_LABELS) as (keyof typeof SIGNAL_LABELS)[]).map((k) => {
                const sig = card.signals[k];
                return (
                  <div key={k} style={{ display: "flex", gap: 8, marginTop: 4 }}>
                    <span
                      style={{
                        width: 52,
                        flexShrink: 0,
                        fontWeight: 700,
                        color: sig.points > 0 ? colors.amber : colors.muted,
                      }}
                    >
                      {sig.pending ? "—" : `${sig.points}/${sig.max}`}
                    </span>
                    <span>
                      <strong>{SIGNAL_LABELS[k]}:</strong>{" "}
                      <span style={{ color: sig.reason ? colors.ink : colors.muted }}>
                        {sig.pending ? "Quiz not answered yet." : sig.reason || "Nothing notable."}
                      </span>
                    </span>
                  </div>
                );
              })}
              {(() => {
                const top = scoreLevers(card).levers[0];
                return top ? (
                  <div style={{ marginTop: 8, color: colors.muted }}>
                    Biggest driver: ¶{top.paragraph}. Without it the score would be {top.scoreWithout}.
                  </div>
                ) : null;
              })()}
            </div>
          ) : (
            reasons.map((f) => (
              <div
                key={f.label}
                style={{ background: colors.amberBg, borderRadius: 8, padding: "8px 12px", color: colors.ink }}
              >
                <strong style={{ color: colors.amber }}>{f.label}: </strong>
                {f.text}
              </div>
            ))
          )}

          {card?.contribution && (
            <ContributionMapView map={card.contribution} reliance={card.reliance} text={s.assignmentText} />
          )}

          {questions.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ fontWeight: 700 }}>
                Comprehension check{" "}
                <span style={{ fontWeight: 400, color: colors.muted }}>
                  {!answered
                    ? "— not answered yet"
                    : comprehension
                      ? comprehension.passed
                        ? "— no follow-up suggested"
                        : "— follow-up suggested"
                      : "— answered, grading pending"}
                </span>
              </div>
              {questions.map((q, i) => (
                <div key={i}>
                  <div style={{ color: colors.muted }}>Q: {q.question}</div>
                  {q.answer_key && (
                    <div style={{ color: colors.muted, fontSize: 12 }}>Expected: {q.answer_key}</div>
                  )}
                  <div style={{ marginTop: 2 }}>
                    {comprehension?.per_question?.[i] && (
                      <span
                        title={comprehension.per_question[i].reason}
                        style={{
                          color: comprehension.per_question[i].adequate ? colors.green : colors.amber,
                          fontWeight: 700,
                          marginRight: 4,
                        }}
                      >
                        {comprehension.per_question[i].adequate ? "✓" : "?"}
                      </span>
                    )}
                    A: {s.quizAnswers?.[i] ? s.quizAnswers[i] : <em style={{ color: colors.muted }}>—</em>}
                    {comprehension?.per_question?.[i] && !comprehension.per_question[i].adequate && (
                      <span style={{ color: colors.muted }}> ({comprehension.per_question[i].reason})</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {s.studentResponse && (
            <div>
              <div style={{ fontWeight: 700 }}>Student&apos;s explanation</div>
              <div style={{ marginTop: 2 }}>{s.studentResponse}</div>
            </div>
          )}

          <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
            {s.status !== "follow_up" && (
              <button
                onClick={() => decide("follow_up")}
                disabled={busy}
                style={{
                  background: colors.ink,
                  color: "#fff",
                  border: "none",
                  borderRadius: 6,
                  padding: "7px 14px",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: busy ? "default" : "pointer",
                }}
              >
                I&apos;ll follow up
              </button>
            )}
            {s.status !== "cleared" && (
              <button
                onClick={() => decide("cleared")}
                disabled={busy}
                style={{
                  background: "#fff",
                  color: colors.ink,
                  border: `1px solid ${colors.cardBorder}`,
                  borderRadius: 6,
                  padding: "7px 14px",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: busy ? "default" : "pointer",
                }}
              >
                Mark cleared
              </button>
            )}
            {s.quiz?.policy_summary && (
              <button
                onClick={() => setShowRule((v) => !v)}
                style={{
                  background: "none",
                  border: "none",
                  padding: 0,
                  color: colors.accent,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {showRule ? "Hide" : "Show"} syllabus AI rule
              </button>
            )}
          </div>
          {showRule && s.quiz?.policy_summary && (
            <div style={{ color: colors.muted, fontSize: 12 }}>{s.quiz.policy_summary}</div>
          )}
        </div>
      )}
    </div>
  );
}
