"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Spinner } from "@/src/components/Spinner";
import { toast } from "@/src/components/Toaster";

const colors = {
  bg: "#F7F5F0",
  ink: "#1E2230",
  muted: "#6B7080",
  accent: "#8A5A3B",
  border: "#E7E2D8",
  cardBorder: "#D8D3C6",
};

export default function NewClassPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [syllabusText, setSyllabusText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/classes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, syllabusText }),
      });
      if (res.status === 401) {
        router.push("/login");
        return;
      }
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong.");
        return;
      }
      toast("Class created. Share the join code with your students.");
      router.push("/classes");
    } finally {
      setLoading(false);
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
        display: "flex",
        justifyContent: "center",
      }}
    >
      <form
        onSubmit={handleSubmit}
        style={{
          width: "100%",
          maxWidth: 640,
          display: "flex",
          flexDirection: "column",
          gap: 18,
        }}
      >
        <Link href="/classes" style={{ fontSize: 13, color: colors.accent, textDecoration: "none" }}>
          ← Back to classes
        </Link>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 600 }}>New class</h1>
        <p style={{ margin: 0, fontSize: 14, color: colors.muted }}>
          Paste the syllabus text, including the AI-use policy — this is what every student
          submission and quiz gets checked against.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label style={{ fontSize: 13, fontWeight: 600 }}>Class name</label>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="HIST 315 — Texan Independence"
            style={{
              border: `1px solid ${colors.cardBorder}`,
              borderRadius: 8,
              padding: "10px 12px",
              fontSize: 14,
            }}
          />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label style={{ fontSize: 13, fontWeight: 600 }}>Syllabus &amp; AI-use policy</label>
          <textarea
            required
            value={syllabusText}
            onChange={(e) => setSyllabusText(e.target.value)}
            placeholder="Paste the full syllabus text here, including the AI-use policy section..."
            rows={14}
            style={{
              border: `1px solid ${colors.cardBorder}`,
              borderRadius: 8,
              padding: "10px 12px",
              fontSize: 14,
              fontFamily: "inherit",
              resize: "vertical",
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
            alignSelf: "flex-start",
          }}
        >
          {loading && <Spinner />} {loading ? "Creating…" : "Create class"}
        </button>
      </form>
    </main>
  );
}
