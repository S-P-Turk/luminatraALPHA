"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

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
  const [togglingId, setTogglingId] = useState<number | null>(null);

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
  }

  async function toggleQuiz(cls: ClassRow) {
    setTogglingId(cls.id);
    try {
      const res = await fetch(`/api/classes/${cls.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quizOpen: !cls.quizOpen }),
      });
      if (res.ok) {
        const data = await res.json();
        setClasses((prev) =>
          prev ? prev.map((c) => (c.id === cls.id ? { ...c, quizOpen: data.class.quizOpen } : c)) : prev
        );
      }
    } finally {
      setTogglingId(null);
    }
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

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
              Luminatra
            </div>
            <h1 style={{ margin: "4px 0 0", fontSize: 26, fontWeight: 600 }}>Your classes</h1>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
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
            <button
              onClick={handleLogout}
              style={{
                background: "#fff",
                color: colors.ink,
                border: `1px solid ${colors.cardBorder}`,
                borderRadius: 8,
                padding: "9px 16px",
                fontSize: 14,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Sign out
            </button>
          </div>
        </div>

        {error && <div style={{ color: "#B8822F", fontSize: 14 }}>{error}</div>}

        {classes === null && !error && (
          <div style={{ color: colors.muted, fontSize: 14 }}>Loading...</div>
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
                  {cls.joinCode ? (
                    <span>
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
                    </span>
                  ) : (
                    <span style={{ color: colors.muted }}>No code (created before this feature)</span>
                  )}
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    padding: "4px 10px",
                    borderRadius: 999,
                    background: cls.quizOpen ? "#E7F1EB" : "#EFEDE6",
                    color: cls.quizOpen ? colors.green : colors.muted,
                  }}
                >
                  {cls.quizOpen ? "Quiz open" : "Quiz closed"}
                </span>
                <button
                  onClick={() => toggleQuiz(cls)}
                  disabled={togglingId === cls.id}
                  style={{
                    background: "#fff",
                    border: `1px solid ${colors.cardBorder}`,
                    borderRadius: 8,
                    padding: "7px 14px",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: togglingId === cls.id ? "default" : "pointer",
                    opacity: togglingId === cls.id ? 0.6 : 1,
                  }}
                >
                  {cls.quizOpen ? "Close quiz" : "Open quiz"}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
