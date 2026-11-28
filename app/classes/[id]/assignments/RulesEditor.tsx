"use client";

import { useState } from "react";
import { CARD_USES, STANCE_LABEL, type CardUse, type UseStance } from "@/src/lib/rules-shared";
import { toast } from "@/src/components/Toaster";

type Card = {
  uses?: Partial<Record<CardUse, UseStance>>;
  disclose: string;
  confirmedByTeacher?: boolean;
};

const CHOICES: UseStance[] = ["allowed", "with_disclosure", "not_allowed", "unclear", "n/a"];

// Lets a teacher change any AI rule for an assignment. Saving makes their
// answers the rules students see and the ones the analysis checks against.
export function RulesEditor({
  classId,
  assignmentId,
  card,
  onSaved,
  onClose,
}: {
  classId: number;
  assignmentId: number;
  card: Card | null;
  onSaved: (rulesCard: unknown) => void;
  onClose: () => void;
}) {
  const [uses, setUses] = useState<Partial<Record<CardUse, UseStance>>>(() => {
    const u: Partial<Record<CardUse, UseStance>> = {};
    for (const { key } of CARD_USES) u[key] = card?.uses?.[key] ?? "unclear";
    return u;
  });
  const [disclose, setDisclose] = useState(card?.disclose ?? "");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    const res = await fetch(`/api/classes/${classId}/assignments/${assignmentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rules: { uses, disclose } }),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) return toast(data.error ?? "Couldn't save the rules.", "error");
    onSaved(data.assignment.rulesCard);
    toast("AI rules saved. Students see these now.");
  }

  return (
    <div style={{ marginTop: 10, border: "1px solid #E4E0D6", borderRadius: 8, padding: "12px 14px", background: "#FBFAF7" }}>
      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Adjust AI rules for this assignment</div>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <tbody>
          {CARD_USES.map(({ key, label }) => (
            <tr key={key} style={{ borderTop: "1px solid #E4E0D6" }}>
              <td style={{ padding: "6px 0" }}>
                <label htmlFor={`rule-${assignmentId}-${key}`}>{label}</label>
              </td>
              <td style={{ padding: "6px 0", textAlign: "right" }}>
                <select
                  id={`rule-${assignmentId}-${key}`}
                  value={uses[key]}
                  onChange={(e) => setUses((u) => ({ ...u, [key]: e.target.value as UseStance }))}
                  style={{ fontSize: 13, padding: "4px 6px", borderRadius: 6, border: "1px solid #D9D4C7", background: "#fff" }}
                >
                  {CHOICES.map((c) => (
                    <option key={c} value={c}>
                      {STANCE_LABEL[c]}
                    </option>
                  ))}
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <label htmlFor={`disclose-${assignmentId}`} style={{ display: "block", fontSize: 13, marginTop: 10, marginBottom: 4 }}>
        How should students disclose AI use?
      </label>
      <input
        id={`disclose-${assignmentId}`}
        value={disclose}
        onChange={(e) => setDisclose(e.target.value)}
        placeholder="e.g. Add a short note at the end saying how you used AI."
        style={{ width: "100%", boxSizing: "border-box", fontSize: 13, padding: "7px 9px", borderRadius: 6, border: "1px solid #D9D4C7" }}
      />
      <div style={{ fontSize: 12, color: "#7A766E", marginTop: 8 }}>
        &ldquo;Not sure&rdquo; tells Luminatra to treat that use as a follow-up, never as breaking a rule.
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
        <button
          onClick={() => void save()}
          disabled={saving}
          style={{ background: "#1F1E1B", color: "#fff", border: "none", borderRadius: 8, padding: "7px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
        >
          {saving ? "Saving…" : "Save rules"}
        </button>
        <button
          onClick={onClose}
          style={{ background: "none", border: "none", color: "#7A766E", fontSize: 13, cursor: "pointer" }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
