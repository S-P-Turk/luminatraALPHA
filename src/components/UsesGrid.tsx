// The six common AI uses and what this assignment's policy says about each.
// Shown to students before they write, and to teachers next to the gaps.

import { CARD_USES, type CardUse, type UseStance } from "@/src/lib/rules-shared";

const LABEL: Record<UseStance, string> = {
  allowed: "Allowed",
  with_disclosure: "Allowed if you disclose it",
  not_allowed: "Not allowed",
  unclear: "Not stated: ask your teacher",
  "n/a": "",
};

const LIGHT: Record<UseStance, string> = {
  allowed: "#2F7D4F",
  with_disclosure: "#2F5E9E",
  not_allowed: "#B4532A",
  unclear: "#7A766E",
  "n/a": "#7A766E",
};

export function UsesGrid({ uses, fontSize = 14 }: { uses?: Partial<Record<CardUse, UseStance>>; fontSize?: number }) {
  if (!uses || Object.keys(uses).length === 0) return null;
  const rows = CARD_USES.filter(({ key }) => uses[key] && uses[key] !== "n/a");
  return (
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize }}>
      <tbody>
        {rows.map(({ key, label }) => {
          const s = uses[key]!;
          return (
            <tr key={key} style={{ borderTop: "1px solid #E4E0D6" }}>
              <td style={{ padding: "6px 0" }}>{label}</td>
              <td style={{ padding: "6px 0 6px 12px", textAlign: "right", fontWeight: 600, color: LIGHT[s], whiteSpace: "nowrap" }}>
                {LABEL[s]}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
