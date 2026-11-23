"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

type Assignment = {
  id: number;
  title: string;
  instructions: string;
  open: boolean;
  createdAt: string;
};

type Suggestion = { title: string; instructions: string };

const colors = {
  bg: "#F7F5F0",
  ink: "#1E2230",
  muted: "#6B7080",
  accent: "#8A5A3B",
  border: "#E7E2D8",
  cardBorder: "#D8D3C6",
  green: "#3F7A5E",
};

export default function AssignmentsClient() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const [className, setClassName] = useState<string | null>(null);
  const [assignments, setAssignments] = useState<Assignment[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [instructions, setInstructions] = useState("");
  const [creating, setCreating] = useState(false);
  const [togglingId, setTogglingId] = useState<number | null>(null);

  const [suggestions, setSuggestions] = useState<Suggestion[] | null>(null);
  const [suggesting, setSuggesting] = useState(false);
  const [suggestError, setSuggestError] = useState<string | null>(null);
  const [addingIndex, setAddingIndex] = useState<number | null>(null);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  async function load() {
    const res = await fetch(`/api/classes/${params.id}/assignments`);
    if (res.status === 401) {
      router.push("/login");
      return;
    }
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Failed to load assignments.");
      return;
    }
    setClassName(data.class.name);
    setAssignments(data.assignments);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setCreating(true);
    try {
      const res = await fetch(`/api/classes/${params.id}/assignments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, instructions }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not create assignment.");
        return;
      }
      setTitle("");
      setInstructions("");
      setAssignments((prev) => (prev ? [data.assignment, ...prev] : [data.assignment]));
    } finally {
      setCreating(false);
    }
  }

  async function handleSuggest() {
    setSuggestError(null);
    setSuggesting(true);
    try {
      const res = await fetch(`/api/classes/${params.id}/assignments/suggest`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setSuggestError(data.error ?? "Could not generate suggestions.");
        return;
      }
      setSuggestions(data.suggestions);
    } finally {
      setSuggesting(false);
    }
  }

  function updateSuggestion(index: number, field: "title" | "instructions", value: string) {
    setSuggestions((prev) =>
      prev ? prev.map((s, i) => (i === index ? { ...s, [field]: value } : s)) : prev
    );
  }

  function dismissSuggestion(index: number) {
    setSuggestions((prev) => (prev ? prev.filter((_, i) => i !== index) : prev));
  }

  async function addSuggestion(index: number) {
    const s = suggestions?.[index];
    if (!s) return;
    setAddingIndex(index);
    setError(null);
    try {
      const res = await fetch(`/api/classes/${params.id}/assignments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: s.title, instructions: s.instructions }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not create assignment.");
        return;
      }
      setAssignments((prev) => (prev ? [data.assignment, ...prev] : [data.assignment]));
      dismissSuggestion(index);
    } finally {
      setAddingIndex(null);
    }
  }

  async function toggleOpen(a: Assignment) {
    setTogglingId(a.id);
    try {
      const res = await fetch(`/api/classes/${params.id}/assignments/${a.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ open: !a.open }),
      });
      if (res.ok) {
        const data = await res.json();
        setAssignments((prev) =>
          prev ? prev.map((x) => (x.id === a.id ? { ...x, open: data.assignment.open } : x)) : prev
        );
      }
    } finally {
      setTogglingId(null);
    }
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
      <div style={{ maxWidth: 720, margin: "0 auto", display: "flex", flexDirection: "column", gap: 20 }}>
        <div>
          <Link href="/classes" style={{ fontSize: 13, color: colors.muted, textDecoration: "none" }}>
            ← Back to classes
          </Link>
          <div
            style={{
              fontSize: 13,
              fontWeight: 600,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: colors.accent,
              marginTop: 10,
            }}
          >
            Luminatra
          </div>
          <h1 style={{ margin: "4px 0 0", fontSize: 26, fontWeight: 600 }}>
            {className ? `${className} — assignments` : "Assignments"}
          </h1>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: colors.muted }}>
            Each assignment is checked against this class&apos;s syllabus AI-use policy — no need to repeat it here.
          </p>
        </div>

        {error && <div style={{ color: "#B8822F", fontSize: 14 }}>{error}</div>}

        <div
          style={{
            background: "#fff",
            border: `1px solid ${colors.border}`,
            borderRadius: 10,
            padding: "18px 20px",
            display: "flex",
            flexDirection: "column",
            gap: 14,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Suggested assignments</h2>
              <p style={{ margin: "2px 0 0", fontSize: 13, color: colors.muted }}>
                Pulled from this class&apos;s syllabus — review and edit before adding any of them.
              </p>
            </div>
            <button
              onClick={handleSuggest}
              disabled={suggesting}
              style={{
                background: "#fff",
                border: `1px solid ${colors.accent}`,
                color: colors.accent,
                borderRadius: 8,
                padding: "9px 14px",
                fontSize: 13,
                fontWeight: 600,
                cursor: suggesting ? "default" : "pointer",
                opacity: suggesting ? 0.6 : 1,
                whiteSpace: "nowrap",
              }}
            >
              {suggesting ? "Reading syllabus..." : suggestions ? "Suggest again" : "Suggest from syllabus"}
            </button>
          </div>

          {suggestError && <div style={{ color: "#B8822F", fontSize: 13 }}>{suggestError}</div>}

          {suggestions?.length === 0 && (
            <div style={{ color: colors.muted, fontSize: 13 }}>
              Nothing concrete came out of the syllabus — try adding one manually below.
            </div>
          )}

          {suggestions && suggestions.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {suggestions.map((s, i) => (
                <div
                  key={i}
                  style={{
                    border: `1px dashed ${colors.cardBorder}`,
                    borderRadius: 8,
                    padding: "12px 14px",
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                  }}
                >
                  <input
                    value={s.title}
                    onChange={(e) => updateSuggestion(i, "title", e.target.value)}
                    style={{
                      border: `1px solid ${colors.cardBorder}`,
                      borderRadius: 6,
                      padding: "7px 10px",
                      fontSize: 14,
                      fontWeight: 600,
                    }}
                  />
                  <textarea
                    value={s.instructions}
                    onChange={(e) => updateSuggestion(i, "instructions", e.target.value)}
                    rows={3}
                    style={{
                      border: `1px solid ${colors.cardBorder}`,
                      borderRadius: 6,
                      padding: "7px 10px",
                      fontSize: 13,
                      fontFamily: "inherit",
                      resize: "vertical",
                    }}
                  />
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      onClick={() => addSuggestion(i)}
                      disabled={addingIndex === i}
                      style={{
                        background: colors.ink,
                        color: "#fff",
                        border: "none",
                        borderRadius: 6,
                        padding: "6px 12px",
                        fontSize: 13,
                        fontWeight: 600,
                        cursor: addingIndex === i ? "default" : "pointer",
                        opacity: addingIndex === i ? 0.6 : 1,
                      }}
                    >
                      {addingIndex === i ? "Adding..." : "Add this assignment"}
                    </button>
                    <button
                      onClick={() => dismissSuggestion(i)}
                      style={{
                        background: "none",
                        border: "none",
                        color: colors.muted,
                        fontSize: 13,
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <form
          onSubmit={handleCreate}
          style={{
            background: "#fff",
            border: `1px solid ${colors.border}`,
            borderRadius: 10,
            padding: "18px 20px",
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Or add one manually</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label style={{ fontSize: 13, fontWeight: 600 }}>Title</label>
            <input
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Essay 1: The Texas Revolution"
              style={{
                border: `1px solid ${colors.cardBorder}`,
                borderRadius: 8,
                padding: "9px 12px",
                fontSize: 14,
              }}
            />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label style={{ fontSize: 13, fontWeight: 600 }}>What does this assignment ask students to do?</label>
            <textarea
              required
              rows={4}
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder="e.g. Write a 300-word journal entry responding to this week's reading..."
              style={{
                border: `1px solid ${colors.cardBorder}`,
                borderRadius: 8,
                padding: "9px 12px",
                fontSize: 14,
                fontFamily: "inherit",
                resize: "vertical",
              }}
            />
          </div>
          <button
            type="submit"
            disabled={creating}
            style={{
              background: colors.ink,
              color: "#fff",
              border: "none",
              borderRadius: 8,
              padding: "10px 16px",
              fontSize: 14,
              fontWeight: 600,
              cursor: creating ? "default" : "pointer",
              opacity: creating ? 0.6 : 1,
              alignSelf: "flex-start",
            }}
          >
            {creating ? "Creating..." : "Create assignment"}
          </button>
        </form>

        {assignments === null && !error && (
          <div style={{ color: colors.muted, fontSize: 14 }}>Loading...</div>
        )}

        {assignments?.length === 0 && (
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
            No assignments yet. Create one above.
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {assignments?.map((a) => (
            <div
              key={a.id}
              style={{
                background: "#fff",
                border: `1px solid ${colors.border}`,
                borderRadius: 10,
                padding: "14px 18px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 16,
                flexWrap: "wrap",
              }}
            >
              <div>
                <div style={{ fontSize: 15, fontWeight: 600 }}>{a.title}</div>
                <div style={{ fontSize: 13, color: colors.muted, marginTop: 2 }}>
                  {a.instructions.slice(0, 100)}
                  {a.instructions.length > 100 ? "..." : ""}
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    padding: "4px 10px",
                    borderRadius: 999,
                    background: a.open ? "#E7F1EB" : "#EFEDE6",
                    color: a.open ? colors.green : colors.muted,
                  }}
                >
                  {a.open ? "Open" : "Closed"}
                </span>
                <button
                  onClick={() => toggleOpen(a)}
                  disabled={togglingId === a.id}
                  style={{
                    background: "#fff",
                    border: `1px solid ${colors.cardBorder}`,
                    borderRadius: 8,
                    padding: "7px 14px",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: togglingId === a.id ? "default" : "pointer",
                    opacity: togglingId === a.id ? 0.6 : 1,
                  }}
                >
                  {a.open ? "Close" : "Open"}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
