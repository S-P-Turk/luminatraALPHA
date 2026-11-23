"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong.");
        return;
      }
      router.push("/classes");
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
        background: "#F7F5F0",
        fontFamily: "Inter, system-ui, sans-serif",
        color: "#1E2230",
      }}
    >
      <form
        onSubmit={handleSubmit}
        style={{
          background: "#FFFFFF",
          border: "1px solid #E7E2D8",
          borderRadius: 12,
          padding: "40px 36px",
          width: 360,
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
            color: "#8A5A3B",
          }}
        >
          Luminatra
        </div>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600 }}>Teacher sign in</h1>
        <p style={{ margin: 0, fontSize: 14, color: "#6B7080" }}>
          Prototype build — enter your email to continue. No password yet.
        </p>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@school.edu"
          style={{
            border: "1px solid #D8D3C6",
            borderRadius: 8,
            padding: "10px 12px",
            fontSize: 14,
          }}
        />
        {error && (
          <div style={{ fontSize: 13, color: "#B8822F" }}>{error}</div>
        )}
        <button
          type="submit"
          disabled={loading}
          style={{
            background: "#1E2230",
            color: "#FFFFFF",
            border: "none",
            borderRadius: 8,
            padding: "10px 18px",
            fontSize: 14,
            fontWeight: 600,
            cursor: loading ? "default" : "pointer",
            opacity: loading ? 0.6 : 1,
          }}
        >
          {loading ? "Signing in..." : "Continue"}
        </button>
      </form>
    </main>
  );
}
