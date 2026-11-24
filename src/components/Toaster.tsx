"use client";

import { useEffect, useState } from "react";

// Tiny toast system: call toast("Saved") from anywhere in client code.
type Kind = "success" | "error" | "info";
type Toast = { id: number; message: string; kind: Kind };

const listeners = new Set<(t: Toast) => void>();
let nextId = 1;

export function toast(message: string, kind: Kind = "success") {
  const t = { id: nextId++, message, kind };
  listeners.forEach((l) => l(t));
}

export function Toaster() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    const add = (t: Toast) => {
      setToasts((prev) => [...prev, t]);
      setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== t.id)), t.kind === "error" ? 6000 : 3500);
    };
    listeners.add(add);
    return () => {
      listeners.delete(add);
    };
  }, []);

  return (
    <div
      aria-live="polite"
      style={{
        position: "fixed",
        bottom: 20,
        left: "50%",
        transform: "translateX(-50%)",
        display: "flex",
        flexDirection: "column",
        gap: 8,
        zIndex: 1000,
        width: "min(420px, calc(100vw - 32px))",
      }}
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          style={{
            animation: "lum-toast-in 160ms ease-out",
            background: t.kind === "error" ? "#7a2e22" : "var(--lum-ink)",
            color: "#fff",
            borderRadius: 10,
            padding: "11px 14px",
            fontSize: 14,
            boxShadow: "0 6px 24px #1e223033",
            display: "flex",
            gap: 8,
            alignItems: "center",
          }}
        >
          <span aria-hidden style={{ color: t.kind === "error" ? "#f3b4a8" : t.kind === "info" ? "#cfd6e6" : "#9fd3b5" }}>
            {t.kind === "error" ? "!" : t.kind === "info" ? "i" : "✓"}
          </span>
          {t.message}
        </div>
      ))}
    </div>
  );
}
