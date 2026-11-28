"use client";

import { useEffect, useState } from "react";

// Small inline spinner for buttons and loading rows.
export function Spinner({ size = 14, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <span
      aria-hidden
      style={{
        display: "inline-block",
        width: size,
        height: size,
        border: `2px solid ${color}`,
        borderRightColor: "transparent",
        borderRadius: "50%",
        animation: "lum-spin 0.7s linear infinite",
        verticalAlign: "-2px",
      }}
    />
  );
}

// A calm progress line for slow AI steps: spinner + message + optional hint.
export function WorkingNote({ message, hint }: { message: string; hint?: string }) {
  return (
    <div
      role="status"
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
        background: "var(--lum-amber-bg)",
        border: "1px solid #ecd9b4",
        borderRadius: 10,
        padding: "12px 14px",
        fontSize: 14,
        color: "var(--lum-ink)",
      }}
    >
      <span style={{ marginTop: 2, color: "var(--lum-accent)" }}>
        <Spinner />
      </span>
      <span>
        <strong style={{ animation: "lum-pulse 1.6s ease-in-out infinite" }}>{message}</strong>
        {hint && <span style={{ display: "block", color: "var(--lum-muted)", fontSize: 13, marginTop: 2 }}>{hint}</span>}
      </span>
    </div>
  );
}

// The wait after a student submits: a larger spinner and the step that's
// running, so it reads as progress rather than a countdown.
const STEPS = [
  "Reading your AI conversation",
  "Matching each paragraph to the chat",
  "Checking the course's AI rules",
  "Working out your score",
];

export function AnalyzingCard() {
  const [since, setSince] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setSince((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);
  // Move through the steps over ~12 s, then stay on the last one.
  const step = Math.min(STEPS.length - 1, Math.max(0, Math.floor(since / 3)));
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        background: "#fff",
        border: "1px solid var(--lum-border, #E4E0D6)",
        borderRadius: 10,
        padding: "22px 20px",
        display: "flex",
        alignItems: "center",
        gap: 18,
      }}
    >
      <span style={{ color: "var(--lum-accent)", flex: "none" }}>
        <Spinner size={30} />
      </span>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: "var(--lum-ink)" }}>Analyzing your submission</div>
        <ol style={{ listStyle: "none", margin: "8px 0 0", padding: 0, fontSize: 14, lineHeight: 1.7 }}>
          {STEPS.map((s, i) => (
            <li key={s} style={{ color: i < step ? "var(--lum-muted)" : i === step ? "var(--lum-ink)" : "#B9B4A8", fontWeight: i === step ? 600 : 400 }}>
              {i < step ? "✓ " : i === step ? "› " : "  "}
              {s}
            </li>
          ))}
        </ol>
        <div style={{ marginTop: 10, fontSize: 13, fontWeight: 600, color: "var(--lum-accent)" }}>
          Please don&apos;t close this page.
        </div>
      </div>
    </div>
  );
}
