"use client";

import Link from "next/link";
import { ReviewCard, colors, type ReviewSubmission } from "./ReviewCard";

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
            Luminatra
          </div>
          <h1 style={{ margin: "4px 0 0", fontSize: 26, fontWeight: 600 }}>{title}</h1>
        </div>

        {error && <div style={{ color: colors.amber, fontSize: 14 }}>{error}</div>}
        {submissions === null && !error && <div style={{ color: colors.muted, fontSize: 14 }}>Loading...</div>}

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
