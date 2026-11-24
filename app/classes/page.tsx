"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Spinner } from "@/src/components/Spinner";

type ClassRow = {
  id: number;
  name: string;
  syllabusText: string;
  quizOpen: boolean;
  joinCode: string | null;
  createdAt: string;
};

const colors = {
  bg: "#F7F5F0",
  ink: "#1E2230",
  muted: "#6B7080",
  accent: "#8A5A3B",
  border: "#E7E2D8",
  cardBorder: "#D8D3C6",
  green: "#3F7A5E",
};

export default function ClassesPage() {
  const router = useRouter();
  const [classes, setClasses] = useState<ClassRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingCodeId, setEditingCodeId] = useState<number | null>(null);
  const [codeDraft, setCodeDraft] = useState("");
  const [codeError, setCodeError] = useState<string | null>(null);
  const [savingCode, setSavingCode] = useState(false);
  const [needsReview, setNeedsReview] = useState<number | null>(null);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    const res = await fetch("/api/classes");
    if (res.status === 401) {
      router.push("/login");
      return;
    }
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Failed to load classes.");
      return;
    }
    setClasses(data.classes);

    const reviewRes = await fetch("/api/review");
    if (reviewRes.ok) {
      const reviewData = await reviewRes.json();
      setNeedsReview(
        (reviewData.submissions as { status: string }[]).filter((s) => s.status === "flagged").length
      );
    }
  }

  function startEditCode(cls: ClassRow) {
    setEditingCodeId(cls.id);
    setCodeDraft(cls.joinCode ?? "");
    setCodeError(null);
  }

  async function saveCode(cls: ClassRow) {
    const next = codeDraft.trim().toUpperCase();
    if (!/^[A-Z0-9]{3,12}$/.test(next)) {
      setCodeError("3-12 letters/numbers.");
      return;
    }
    setSavingCode(true);
    setCodeError(null);
    try {
      const res = await fetch(`/api/classes/${cls.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ joinCode: next }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCodeError(data.error ?? "Could not save code.");
        return;
      }
      setClasses((prev) =>
        prev ? prev.map((c) => (c.id === cls.id ? { ...c, joinCode: data.class.joinCode } : c)) : prev
      );
      setEditingCodeId(null);
    } finally {
      setSavingCode(false);
    }
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
      <div style={{ maxWidth: 820, margin: "0 auto", display: "flex", flexDirection: "column", gap: 24 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div
              style={{
                fontSize: 13,
                fontWeight: 600,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: colors.accent,
              }}
            >
              Teacher
            </div>
            <h1 style={{ margin: "4px 0 0", fontSize: 26, fontWeight: 600 }}>Your classes</h1>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <Link
              href="/review"
              style={{
                background: needsReview ? "#FBF0DA" : "#fff",
                color: needsReview ? "#B8822F" : colors.ink,
                border: `1px solid ${needsReview ? "#B8822F" : colors.cardBorder}`,
                borderRadius: 8,
                padding: "9px 16px",
                fontSize: 14,
                fontWeight: 600,
                textDecoration: "none",
              }}
            >
              Review{needsReview ? ` (${needsReview})` : ""}
            </Link>
            <Link
              href="/classes/new"
              style={{
                background: colors.ink,
                color: "#fff",
                border: "none",
                borderRadius: 8,
                padding: "9px 16px",
                fontSize: 14,
                fontWeight: 600,
                textDecoration: "none",
              }}
            >
              + New class
            </Link>
          </div>
        </div>

        {error && <div style={{ color: "#B8822F", fontSize: 14 }}>{error}</div>}

        {classes === null && !error && (
          <div style={{ color: colors.muted, fontSize: 14 }}><Spinner /> Loading…</div>
        )}

        {classes?.length === 0 && (
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
            No classes yet. Create one to get started.
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {classes?.map((cls) => (
            <div
              key={cls.id}
              style={{
                background: "#fff",
                border: `1px solid ${colors.border}`,
                borderRadius: 10,
                padding: "16px 20px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 16,
                flexWrap: "wrap",
              }}
            >
              <div>
                <div style={{ fontSize: 16, fontWeight: 600 }}>{cls.name}</div>
                <div style={{ fontSize: 13, color: colors.muted, marginTop: 2 }}>
                  {cls.syllabusText.slice(0, 90)}
                  {cls.syllabusText.length > 90 ? "..." : ""}
                </div>
                <div style={{ fontSize: 12, marginTop: 6 }}>
                  {editingCodeId === cls.id ? (
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span>Class code:</span>
                      <input
                        value={codeDraft}
                        onChange={(e) => setCodeDraft(e.target.value.toUpperCase())}
                        maxLength={12}
                        style={{
                          fontFamily: "monospace",
                          fontWeight: 700,
                          letterSpacing: "0.08em",
                          border: `1px solid ${colors.cardBorder}`,
                          borderRadius: 6,
                          padding: "2px 6px",
                          width: 100,
                        }}
                      />
                      <button
                        onClick={() => saveCode(cls)}
                        disabled={savingCode}
                        style={{
                          border: "none",
                          background: colors.ink,
                          color: "#fff",
                          borderRadius: 6,
                          padding: "3px 8px",
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: savingCode ? "default" : "pointer",
                        }}
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditingCodeId(null)}
                        style={{
                          border: "none",
                          background: "none",
                          color: colors.muted,
                          fontSize: 12,
                          cursor: "pointer",
                        }}
                      >
                        Cancel
                      </button>
                      {codeError && <span style={{ color: colors.accent }}>{codeError}</span>}
                    </div>
                  ) : (
                    <span>
                      {cls.joinCode ? (
                        <>
                          Class code:{" "}
                          <span
                            style={{
                              fontFamily: "monospace",
                              fontWeight: 700,
                              letterSpacing: "0.08em",
                              color: colors.ink,
                            }}
                          >
                            {cls.joinCode}
                          </span>
                        </>
                      ) : (
                        <span style={{ color: colors.muted }}>No code (created before this feature)</span>
                      )}{" "}
                      <button
                        onClick={() => startEditCode(cls)}
                        style={{
                          border: "none",
                          background: "none",
                          color: colors.accent,
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: "pointer",
                          padding: 0,
                          marginLeft: 4,
                        }}
                      >
                        Edit
                      </button>
                    </span>
                  )}
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Link
                  href={`/classes/${cls.id}/assignments`}
                  style={{
                    background: "#fff",
                    color: colors.ink,
                    border: `1px solid ${colors.cardBorder}`,
                    borderRadius: 8,
                    padding: "7px 14px",
                    fontSize: 13,
                    fontWeight: 600,
                    textDecoration: "none",
                  }}
                >
                  Assignments
                </Link>
                <Link
                  href={`/classes/${cls.id}/submissions`}
                  style={{
                    background: "#fff",
                    color: colors.ink,
                    border: `1px solid ${colors.cardBorder}`,
                    borderRadius: 8,
                    padding: "7px 14px",
                    fontSize: 13,
                    fontWeight: 600,
                    textDecoration: "none",
                  }}
                >
                  Review submissions
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
