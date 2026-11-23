"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type StudentMe = {
  student: { name: string; email: string; classId: number };
  class: { id: number; name: string; quizOpen: boolean };
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

export default function StudentHomePage() {
  const router = useRouter();
  const [data, setData] = useState<StudentMe | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    const res = await fetch("/api/auth/student-me");
    if (res.status === 401) {
      router.push("/student/login");
      return;
    }
    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? "Something went wrong.");
      return;
    }
    setData(json);
  }

  async function handleLeave() {
    await fetch("/api/auth/student-logout", { method: "POST" });
    router.push("/student/login");
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: colors.bg,
        fontFamily: "Inter, system-ui, sans-serif",
        color: colors.ink,
        padding: 24,
      }}
    >
      <div
        style={{
          background: "#fff",
          border: `1px solid ${colors.border}`,
          borderRadius: 12,
          padding: "36px 32px",
          width: 420,
          display: "flex",
          flexDirection: "column",
          gap: 16,
          textAlign: "center",
        }}
      >
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

        {error && <div style={{ fontSize: 14, color: "#B8822F" }}>{error}</div>}

        {data && (
          <>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600 }}>{data.class.name}</h1>
            <p style={{ margin: 0, fontSize: 14, color: colors.muted }}>
              Signed in as {data.student.name}
            </p>

            {data.class.quizOpen ? (
              <div
                style={{
                  background: "#E7F1EB",
                  color: colors.green,
                  borderRadius: 8,
                  padding: "14px 16px",
                  fontSize: 14,
                  fontWeight: 600,
                }}
              >
                Quiz is open — submission flow coming soon.
              </div>
            ) : (
              <div
                style={{
                  background: "#EFEDE6",
                  color: colors.muted,
                  borderRadius: 8,
                  padding: "14px 16px",
                  fontSize: 14,
                  fontWeight: 600,
                }}
              >
                Waiting for your teacher to open the quiz in class.
              </div>
            )}

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
                alignSelf: "center",
              }}
            >
              Not you? Switch student
            </button>
          </>
        )}
      </div>
    </main>
  );
}
