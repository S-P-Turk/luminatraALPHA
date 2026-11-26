"use client";

import { Fragment, useEffect, useState } from "react";
import { K, Cell, Btn, th, td, tdMono } from "../ui";
import { toast } from "@/src/components/Toaster";
import { REAL_POLICY_CASES } from "@/src/lib/eval/policies-real";
import type { RulesCheckResult } from "@/src/lib/eval/rules-check";
import { gradeCase, GRADES, type Grade, type Miss } from "@/src/lib/eval/rules-grade";

// Runs the rules-card check on the 39 real course policies, on the live
// site's API key, from the browser. Same logic as scripts/eval/eval-rules.ts.

type Row = { id: string; state: "idle" | "running" | "done" | "error"; result?: RulesCheckResult; error?: string };

const CONCURRENCY = 4;
const GRADE_LABEL: Record<Grade, string> = {
  match: "match",
  defensible: "defensible reading",
  near: "near miss",
  soft: "soft miss",
  strict: "too strict",
  lenient: "too lenient",
};

export function RulesCheck() {
  const [rows, setRows] = useState<Row[]>(REAL_POLICY_CASES.map((p) => ({ id: p.id, state: "idle" })));
  const [running, setRunning] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  // Show the last saved check so results survive a reload or leaving the page.
  useEffect(() => {
    fetch("/api/admin/eval/rules")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        const results = (d?.saved?.results ?? []) as RulesCheckResult[];
        if (!results.length) return;
        const byId = new Map(results.map((r) => [r.id, r]));
        setRows((prev) => prev.map((r) => (byId.has(r.id) ? { id: r.id, state: "done", result: byId.get(r.id) } : r)));
        setSavedAt(new Date(d.saved.at).toLocaleString());
      })
      .catch(() => {});
  }, []);

  async function run(ids?: string[]) {
    setRunning(true);
    const targets = ids ?? REAL_POLICY_CASES.map((p) => p.id);
    setRows((prev) => prev.map((r) => (targets.includes(r.id) ? { id: r.id, state: "idle" } : r)));
    const queue = [...targets];
    const collected = new Map<string, RulesCheckResult>();
    async function worker() {
      while (queue.length) {
        const id = queue.shift()!;
        setRows((prev) => prev.map((r) => (r.id === id ? { ...r, state: "running" } : r)));
        let res = await fetch(`/api/admin/eval/rules/${id}`, { method: "POST" }).catch(() => null);
        if (res && !res.ok && res.status !== 401 && res.status !== 404) {
          await new Promise((r) => setTimeout(r, 3000)); // one retry for transient AI errors
          res = await fetch(`/api/admin/eval/rules/${id}`, { method: "POST" }).catch(() => null);
        }
        const d = res ? await res.json().catch(() => ({})) : {};
        if (res?.ok && d.result) collected.set(id, d.result);
        setRows((prev) =>
          prev.map((r) =>
            r.id !== id ? r : res?.ok ? { id, state: "done", result: d.result } : { id, state: "error", error: d.error ?? "request failed" }
          )
        );
      }
    }
    await Promise.all(Array.from({ length: CONCURRENCY }, worker));
    setRunning(false);
    if (!ids && collected.size) {
      const ok = await fetch("/api/admin/eval/rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ results: [...collected.values()] }),
      }).then((r) => r.ok, () => false);
      if (ok) setSavedAt(new Date().toLocaleString());
    }
  }

  const done = rows.filter((r) => r.state === "done");
  const errored = rows.filter((r) => r.state === "error");
  // Re-score from the card's answers with the current labels, so label
  // changes show up without rerunning the model.
  const graded = new Map<string, { tally: Record<Grade, number>; misses: Miss[]; teacherFixes: number }>();
  for (const r of done) {
    const p = REAL_POLICY_CASES.find((x) => x.id === r.id);
    if (p && r.result?.got) graded.set(r.id, gradeCase(p, r.result.got));
  }
  const tally = Object.fromEntries(GRADES.map((g) => [g, 0])) as Record<Grade, number>;
  for (const g of graded.values()) for (const k of GRADES) tally[k] += g.tally[k];
  const total = Object.values(tally).reduce((a, b) => a + b, 0);
  const pctOf = (n: number) => (total ? `${Math.round((n / total) * 100)}%` : "—");
  const fixes = [...graded.values()].reduce((n, g) => n + g.teacherFixes, 0);
  const perSyllabus = graded.size ? (fixes / graded.size).toFixed(1) : "—";
  const cleanCards = [...graded.values()].filter((g) => g.teacherFixes === 0).length;

  // Worst first: lenient, then strict, then other misses, then clean.
  const g = (id: string) => graded.get(id);
  const rank = (r: Row) =>
    r.state === "error" ? 0 : !g(r.id) ? 5 : g(r.id)!.tally.lenient ? 1 : g(r.id)!.tally.strict ? 2 : g(r.id)!.teacherFixes ? 3 : 4;
  const sorted = [...rows].sort((a, b) => rank(a) - rank(b));

  function copyResults() {
    const lines = [
      `Rules-card check: ${done.length}/${rows.length} policies, ${total} labeled uses`,
      `strict exact ${tally.match} (${pctOf(tally.match)}) · with defensible readings ${tally.match + tally.defensible} (${pctOf(tally.match + tally.defensible)})`,
      `teacher fixes: ${perSyllabus} rows per syllabus · ${cleanCards}/${graded.size} cards need no change`,
      `near ${tally.near} · soft ${tally.soft} · too strict ${tally.strict} · too lenient ${tally.lenient}`,
      "",
      ...sorted
        .filter((r) => r.state === "error" || (g(r.id) && g(r.id)!.misses.length))
        .map((r) =>
          r.state === "error"
            ? `ERR ${r.id}: ${r.error}`
            : `${r.id}: ${g(r.id)!.misses.map((m) => `${m.use} expected ${m.expected}, card ${m.got} (${GRADE_LABEL[m.grade]})`).join("; ")}`
        ),
    ];
    navigator.clipboard.writeText(lines.join("\n")).then(
      () => toast("Results copied. Paste them into the chat."),
      () => toast("Couldn't copy.", "error")
    );
  }

  return (
    <Cell label={`rules-card check · ${REAL_POLICY_CASES.length} real course policies`} refId="B2" id="rules-check">
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginBottom: 10 }}>
        <Btn primary onClick={() => void run()} disabled={running}>
          {running ? `running ${done.length + errored.length}/${rows.length}` : "run rules check"}
        </Btn>
        {errored.length > 0 && !running && (
          <Btn onClick={() => void run(errored.map((r) => r.id))}>retry {errored.length} errored</Btn>
        )}
        {done.length > 0 && <Btn onClick={copyResults}>copy results</Btn>}
        {savedAt && <span style={{ fontFamily: K.mono, fontSize: 12, color: K.sage }}>showing run from {savedAt}</span>}
        <span style={{ fontFamily: K.mono, fontSize: 12, color: K.mute }}>
          writes each rules card, then checks it against hand labels for six uses. ~80 calls, about $1.
        </span>
      </div>

      {total > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 18px", fontFamily: K.mono, fontSize: 12, marginBottom: 10 }}>
          <span>{done.length}/{rows.length} policies · {total} labeled uses</span>
          <span style={{ color: K.sage }}>strict exact {tally.match} ({pctOf(tally.match)})</span>
          <span style={{ color: K.sage }}>with defensible readings {pctOf(tally.match + tally.defensible)}</span>
          <span style={{ color: K.fg }}>teacher fixes {perSyllabus}/syllabus · {cleanCards}/{graded.size} cards need none</span>
          <span style={{ color: K.mute }}>near miss {tally.near}</span>
          <span style={{ color: K.mute }}>soft miss {tally.soft}</span>
          <span style={{ color: tally.strict ? K.sig : K.mute }}>too strict {tally.strict}</span>
          <span style={{ color: tally.lenient ? K.clay : K.mute }}>too lenient {tally.lenient}</span>
        </div>
      )}

      <div style={{ overflowX: "auto" }}>
        <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 560 }}>
          <thead>
            <tr>
              <th style={th}>policy</th>
              <th style={th}>subject</th>
              <th style={th}>result</th>
              <th style={th}>misses</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => {
              const p = REAL_POLICY_CASES.find((x) => x.id === r.id)!;
              const res = r.result;
              const gr = g(r.id);
              const status =
                r.state === "running" ? "running…" : r.state === "error" ? "error" : !gr ? "—" : gr.tally.lenient ? "too lenient" : gr.tally.strict ? "too strict" : gr.teacherFixes ? `${gr.teacherFixes} fix${gr.teacherFixes > 1 ? "es" : ""}` : "ok";
              const color = status === "too lenient" || status === "error" ? K.clay : status === "too strict" ? K.sig : status === "ok" ? K.sage : K.mute;
              return (
                <Fragment key={r.id}>
                  <tr onClick={() => res && setOpen(open === r.id ? null : r.id)} style={{ cursor: res ? "pointer" : "default" }}>
                    <td style={tdMono}>{p.course.split(" · ").slice(0, 2).join(" · ")}</td>
                    <td style={td}>{p.discipline}</td>
                    <td style={{ ...tdMono, color }}>{status}</td>
                    <td style={{ ...td, color: K.mute }}>
                      {r.state === "error"
                        ? r.error
                        : gr?.misses.map((m) => `${m.use}: ${m.expected} → ${m.got}${m.grade === "defensible" ? " (defensible)" : ""}`).join(" · ")}
                    </td>
                  </tr>
                  {open === r.id && res && (
                    <tr>
                      <td colSpan={4} style={{ ...td, fontSize: 12, lineHeight: 1.5 }}>
                        {res.card.uses && (
                          <div style={{ fontFamily: K.mono }}>
                            <strong>Per use:</strong>{" "}
                            {Object.entries(res.card.uses).map(([u, v]) => `${u} ${v}`).join(" · ")}
                          </div>
                        )}
                        <div><strong>Allowed:</strong> {res.card.allowed.join("; ") || "none listed"}</div>
                        <div><strong>Not allowed:</strong> {res.card.notAllowed.join("; ") || "none listed"}</div>
                        <div><strong>Disclosure:</strong> {res.card.disclose || "not mentioned"}</div>
                        <div><strong>Gaps:</strong> {res.card.gaps.join("; ") || "none"}</div>
                        {gr?.misses.filter((m) => m.why).map((m) => (
                          <div key={m.use} style={{ color: K.mute }}>Defensible {m.use}: {m.why}</div>
                        ))}
                        {p.quirk && <div style={{ color: K.mute, marginTop: 4 }}>Why it&apos;s hard: {p.quirk}</div>}
                        {p.source && (
                          <a href={p.source} target="_blank" rel="noreferrer" style={{ color: K.sig, fontFamily: K.mono }}>
                            source ▸
                          </a>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </Cell>
  );
}
