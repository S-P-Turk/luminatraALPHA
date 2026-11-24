"use client";

import Link from "next/link";
import { ReviewCard, colors, scoreOf, type ReviewSubmission } from "./ReviewCard";
import { WorkingNote } from "./Spinner";

export function ReviewList({
  title,
  back,
  submissions,
  error,
  showAll,
  setShowAll,
  onCleared,
}: {
  title: string;
  back: { href: string; label: string };
  submissions: ReviewSubmission[] | null;
  error: string | null;
  showAll: boolean;
  setShowAll: (fn: (v: boolean) => boolean) => void;
  onCleared: (id: number, status: string) => void;
}) {
  // Highest follow-up priority first; unscored ones last.
  const byScore = (a: ReviewSubmission, b: ReviewSubmission) => (scoreOf(b) ?? -1) - (scoreOf(a) ?? -1);
  const flagged = (submissions?.filter((s) => s.status === "flagged") ?? []).sort(byScore);
  const followingUp = (submissions?.filter((s) => s.status === "follow_up") ?? []).sort(byScore);
  const rest = (submissions?.filter((s) => s.status !== "flagged" && s.status !== "follow_up") ?? []).sort(byScore);

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
      <div style={{ maxWidth: 820, margin: "0 auto", display: "flex", flexDirection: "column", gap: 20 }}>
        <div>
          <Link href={back.href} style={{ fontSize: 13, color: colors.muted, textDecoration: "none" }}>
            {back.label}
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
            Teacher · Review
          </div>
          <h1 style={{ margin: "4px 0 0", fontSize: 26, fontWeight: 600 }}>{title}</h1>
        </div>

        {error && <div style={{ color: colors.amber, fontSize: 14 }}>{error}</div>}
        {submissions === null && !error && (
          <WorkingNote
            message="Loading submissions…"
            hint="Newly answered quizzes are checked as the page loads, so this can take a few seconds."
          />
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
            No submissions yet.
          </div>
        )}

        {submissions && submissions.length > 0 && (
          <>
            <div>
              <h2 style={{ fontSize: 15, fontWeight: 700, margin: "0 0 10px" }}>
                Needs review{flagged.length > 0 ? ` (${flagged.length})` : ""}
              </h2>
              {flagged.length === 0 ? (
                <div style={{ color: colors.muted, fontSize: 13 }}>Nothing to review — all clear.</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {flagged.map((s) => (
                    <ReviewCard key={s.id} s={s} onCleared={onCleared} />
                  ))}
                </div>
              )}
            </div>

            {followingUp.length > 0 && (
              <div>
                <h2 style={{ fontSize: 15, fontWeight: 700, margin: "0 0 10px" }}>
                  Following up ({followingUp.length})
                </h2>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {followingUp.map((s) => (
                    <ReviewCard key={s.id} s={s} onCleared={onCleared} />
                  ))}
                </div>
              </div>
            )}

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
                      <ReviewCard key={s.id} s={s} onCleared={onCleared} />
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
