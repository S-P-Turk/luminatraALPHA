"use client";

import { useEffect, useState } from "react";
import { toast } from "./Toaster";
import { Spinner } from "./Spinner";

type RosterStudent = { name: string; email: string; joinedAt: string; hasPassword: boolean };

// Students in a class, with a password reset for when someone forgets theirs.
export function ClassRoster({ classId }: { classId: string }) {
  const [students, setStudents] = useState<RosterStudent[] | null>(null);
  const [resetting, setResetting] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);

  useEffect(() => {
    void fetch(`/api/classes/${classId}/students`)
      .then((r) => (r.ok ? r.json() : { students: [] }))
      .then((d) => setStudents(d.students))
      .catch(() => setStudents([]));
  }, [classId]);

  async function reset(email: string, name: string) {
    setResetting(email);
    try {
      const res = await fetch(`/api/classes/${classId}/students/reset`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        toast(d.error ?? "Couldn't reset that password.", "error");
        return;
      }
      setStudents((prev) => prev?.map((s) => (s.email === email ? { ...s, hasPassword: false } : s)) ?? prev);
      toast(`${name} can now create a new password at sign-in.`);
    } finally {
      setResetting(null);
      setConfirming(null);
    }
  }

  return (
    <div style={{ background: "#fff", border: "1px solid var(--lum-border)", borderRadius: 10, padding: "16px 18px" }}>
      <h2 style={{ margin: 0, fontSize: 18 }}>
        Students{students ? ` (${students.length})` : ""}
      </h2>
      <p style={{ margin: "4px 0 12px", fontSize: 13, color: "var(--lum-muted)" }}>
        Students join with your class code. If one forgets their password, reset it here — they&apos;ll create a new
        one the next time they sign in, so ask them to sign in right away.
      </p>
      {students === null && <div style={{ fontSize: 13, color: "var(--lum-muted)" }}>Loading…</div>}
      {students?.length === 0 && (
        <div style={{ fontSize: 13, color: "var(--lum-muted)" }}>No students have joined yet.</div>
      )}
      <div style={{ display: "flex", flexDirection: "column" }}>
        {students?.map((s) => (
          <div
            key={s.email}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              padding: "9px 0",
              borderTop: "1px solid var(--lum-border)",
              fontSize: 14,
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 600 }}>{s.name}</div>
              <div style={{ fontSize: 12, color: "var(--lum-muted)", overflow: "hidden", textOverflow: "ellipsis" }}>
                {s.email}
                {!s.hasPassword && " · no password yet"}
              </div>
            </div>
            {s.hasPassword &&
              (confirming === s.email ? (
                <span style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                  <button
                    onClick={() => reset(s.email, s.name)}
                    disabled={resetting === s.email}
                    style={{
                      background: "var(--lum-ink)",
                      color: "#fff",
                      border: "none",
                      borderRadius: 6,
                      padding: "6px 10px",
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: "pointer",
                      display: "inline-flex",
                      gap: 6,
                      alignItems: "center",
                    }}
                  >
                    {resetting === s.email && <Spinner size={11} />} Confirm reset
                  </button>
                  <button
                    onClick={() => setConfirming(null)}
                    style={{
                      background: "#fff",
                      border: "1px solid var(--lum-border-strong)",
                      borderRadius: 6,
                      padding: "6px 10px",
                      fontSize: 12,
                      cursor: "pointer",
                    }}
                  >
                    Cancel
                  </button>
                </span>
              ) : (
                <button
                  onClick={() => setConfirming(s.email)}
                  style={{
                    flexShrink: 0,
                    background: "#fff",
                    color: "var(--lum-ink)",
                    border: "1px solid var(--lum-border-strong)",
                    borderRadius: 6,
                    padding: "6px 10px",
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Reset password
                </button>
              ))}
          </div>
        ))}
      </div>
    </div>
  );
}
