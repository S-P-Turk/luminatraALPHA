"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const colors = {
  bg: "#F7F5F0",
  ink: "#1E2230",
  muted: "#6B7080",
  accent: "#8A5A3B",
  border: "#E7E2D8",
  cardBorder: "#D8D3C6",
};

export default function StudentLoginPage() {
  const router = useRouter();
  const [joinCode, setJoinCode] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/student-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ joinCode, name, email }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong.");
        return;
      }
      router.push("/student");
    } finally {
      setLoading(false);
    }
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
      }}
    >
      <form
        onSubmit={handleSubmit}
        style={{
          background: "#FFFFFF",
          border: `1px solid ${colors.border}`,
          borderRadius: 12,
          padding: "40px 36px",
          width: 380,
          display: "flex",
          flexDirection: "column",
          gap: 16,
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
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600 }}>Join your class</h1>
        <p style={{ margin: 0, fontSize: 14, color: colors.muted }}>
          Your teacher shared a class code — enter it below.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label style={{ fontSize: 13, fontWeight: 600 }}>Class code</label>
          <input
            required
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            placeholder="ABC123"
            style={{
              border: `1px solid ${colors.cardBorder}`,
              borderRadius: 8,
              padding: "10px 12px",
              fontSize: 16,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
            }}
          />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label style={{ fontSize: 13, fontWeight: 600 }}>Your name</label>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Maya Chen"
            style={{
              border: `1px solid ${colors.cardBorder}`,
              borderRadius: 8,
              padding: "10px 12px",
              fontSize: 14,
            }}
          />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label style={{ fontSize: 13, fontWeight: 600 }}>Your email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@school.edu"
            style={{
              border: `1px solid ${colors.cardBorder}`,
              borderRadius: 8,
              padding: "10px 12px",
              fontSize: 14,
            }}
          />
        </div>

        {error && <div style={{ fontSize: 13, color: "#B8822F" }}>{error}</div>}

        <button
          type="submit"
          disabled={loading}
          style={{
            background: colors.ink,
            color: "#fff",
            border: "none",
            borderRadius: 8,
            padding: "10px 18px",
            fontSize: 14,
            fontWeight: 600,
            cursor: loading ? "default" : "pointer",
            opacity: loading ? 0.6 : 1,
          }}
        >
          {loading ? "Joining..." : "Join class"}
        </button>

        <Link href="/" style={{ fontSize: 13, color: colors.accent, textDecoration: "none", textAlign: "center" }}>
          ← Back
        </Link>
      </form>
    </main>
  );
}
