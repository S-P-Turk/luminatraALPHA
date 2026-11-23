"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type ClassSummary = {
  id: number;
  name: string;
  totalAssignments: number;
  openUnsubmitted: number;
  needsResponse: number;
  needsAnswers: number;
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

function statusLabel(cls: ClassSummary): { text: string; bg: string; fg: string } {
  if (cls.needsResponse > 0) {
    return { text: `Needs your response (${cls.needsResponse})`, bg: colors.amberBg, fg: colors.amber };
  }
  if (cls.needsAnswers > 0) {
    return { text: `Quiz ready (${cls.needsAnswers})`, bg: colors.amberBg, fg: colors.amber };
  }
  if (cls.openUnsubmitted > 0) {
    return { text: `${cls.openUnsubmitted} open assignment${cls.openUnsubmitted === 1 ? "" : "s"}`, bg: colors.amberBg, fg: colors.amber };
  }
  if (cls.totalAssignments === 0) {
    return { text: "No assignments yet", bg: "#EFEDE6", fg: colors.muted };
  }
  return { text: "All caught up", bg: "#E7F1EB", fg: colors.green };
}

export default function StudentHomePage() {
  const router = useRouter();
  const [name, setName] = useState<string | null>(null);
  const [classes, setClasses] = useState<ClassSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [joinCode, setJoinCode] = useState("");
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    const res = await fetch("/api/auth/student-me");
    if (res.status === 401) {
      router.push("/student/login");
      return;
    }
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Something went wrong.");
      return;
    }
    setName(data.student.name);
    setClasses(data.classes);
  }

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    setJoinError(null);
    setJoining(true);
    try {
      const res = await fetch("/api/student/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ joinCode }),
      });
      const data = await res.json();
      if (!res.ok) {
        setJoinError(data.error ?? "Could not join that class.");
        return;
      }
      setJoinCode("");
      await load();
    } finally {
      setJoining(false);
    }
  }

  async function handleLeave() {
    await fetch("/api/auth/student-logout", { method: "POST" });
    router.push("/student/login");
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
      <div style={{ maxWidth: 640, margin: "0 auto", display: "flex", flexDirection: "column", gap: 24 }}>
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
            {name && <p style={{ margin: "2px 0 0", fontSize: 13, color: colors.muted }}>Signed in as {name}</p>}
          </div>
          <button
            onClick={handleLeave}
            style={{
              background: "#fff",
              border: `1px solid ${colors.cardBorder}`,
              borderRadius: 8,
              padding: "9px 16px",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Not you? Switch student
          </button>
        </div>

        <form
          onSubmit={handleJoin}
          style={{
            background: "#fff",
            border: `1px solid ${colors.border}`,
            borderRadius: 10,
            padding: "16px 20px",
            display: "flex",
            alignItems: "flex-end",
            gap: 10,
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1, minWidth: 160 }}>
            <label style={{ fontSize: 13, fontWeight: 600 }}>Join another class</label>
            <input
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              placeholder="Class code, e.g. ABC123"
              style={{
                border: `1px solid ${colors.cardBorder}`,
                borderRadius: 8,
                padding: "9px 12px",
                fontSize: 14,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
              }}
            />
          </div>
          <button
            type="submit"
            disabled={joining || !joinCode}
            style={{
              background: colors.ink,
              color: "#fff",
              border: "none",
              borderRadius: 8,
              padding: "10px 16px",
              fontSize: 14,
              fontWeight: 600,
              cursor: joining || !joinCode ? "default" : "pointer",
              opacity: joining || !joinCode ? 0.6 : 1,
            }}
          >
            {joining ? "Joining..." : "Join"}
          </button>
          {joinError && <div style={{ width: "100%", fontSize: 13, color: colors.amber }}>{joinError}</div>}
        </form>

        {error && <div style={{ color: colors.amber, fontSize: 14 }}>{error}</div>}

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
            You haven&apos;t joined a class yet. Enter the code your teacher gave you above.
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {classes?.map((cls) => {
            const label = statusLabel(cls);
            return (
              <Link
                key={cls.id}
                href={`/student/classes/${cls.id}`}
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
                <div style={{ fontSize: 16, fontWeight: 600 }}>{cls.name}</div>
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
