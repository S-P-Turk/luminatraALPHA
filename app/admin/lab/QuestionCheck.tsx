"use client";

import { Fragment, useEffect, useState } from "react";
import { K, Cell, Btn, th, td, tdMono, usd } from "../ui";
import { toast } from "@/src/components/Toaster";
import { QUESTION_CASES, summarizeQuestions, type QuestionCheckResult } from "@/src/lib/eval/questions-shared";

// Checks the comprehension questions themselves: do they follow the rules,
// is the answer key really in the student's paragraph, and does a student who
// did the work pass while one who only knows the topic fails?

type Row = { id: string; state: "idle" | "running" | "done" | "error"; result?: QuestionCheckResult; error?: string };
const CONCURRENCY = 4;

export function QuestionCheck() {
  const [rows, setRows] = useState<Row[]>(QUESTION_CASES.map((c) => ({ id: c.id, state: "idle" })));
  const [running, setRunning] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/eval/questions")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        const results = (d?.saved?.results ?? []) as QuestionCheckResult[];
        if (!results.length) return;
        const byId = new Map(results.map((r) => [r.id, r]));
        setRows((prev) => prev.map((r) => (byId.has(r.id) ? { id: r.id, state: "done", result: byId.get(r.id) } : r)));
        setSavedAt(new Date(d.saved.at).toLocaleString());
      })
      .catch(() => {});
  }, []);

  async function run(ids?: string[]) {
    setRunning(true);
    const targets = ids ?? QUESTION_CASES.map((c) => c.id);
    setRows((prev) => prev.map((r) => (targets.includes(r.id) ? { id: r.id, state: "idle" } : r)));
    const queue = [...targets];
    const collected = new Map<string, QuestionCheckResult>();
    async function worker() {
      while (queue.length) {
        const id = queue.shift()!;
        setRows((prev) => prev.map((r) => (r.id === id ? { ...r, state: "running" } : r)));
        let res = await fetch(`/api/admin/eval/questions/${id}`, { method: "POST" }).catch(() => null);
        if (res && !res.ok && res.status !== 401 && res.status !== 404) {
          await new Promise((r) => setTimeout(r, 3000));
          res = await fetch(`/api/admin/eval/questions/${id}`, { method: "POST" }).catch(() => null);
        }
        const d = res ? await res.json().catch(() => ({})) : {};
        if (res?.ok && d.result) collected.set(id, d.result);
        setRows((prev) =>
          prev.map((r) => (r.id !== id ? r : res?.ok ? { id, state: "done", result: d.result } : { id, state: "error", error: d.error ?? "request failed" }))
        );
      }
    }
    await Promise.all(Array.from({ length: CONCURRENCY }, worker));
    setRunning(false);
    if (!ids && collected.size) {
      const ok = await fetch("/api/admin/eval/questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ results: [...collected.values()] }),
      }).then((r) => r.ok, () => false);
      if (ok) setSavedAt(new Date().toLocaleString());
    }
  }

  const done = rows.filter((r) => r.state === "done" && r.result);
  const errored = rows.filter((r) => r.state === "error");
  const s = summarizeQuestions(done.map((r) => r.result!));
  const p = (n: number) => (s.questions ? `${Math.round((n / s.questions) * 100)}%` : "—");
  const cost = done.reduce((n, r) => n + (r.result!.costUsd ?? 0), 0);
  // A question's verdict, worst first.
  const verdict = (q: QuestionCheckResult["questions"][number]) =>
    q.problems.length ? "breaks rules" : !q.authorOk ? "author failed" : q.bluffOk ? "bluffable" : q.onAiParagraph ? "on AI text" : !q.grounded ? "key not in ¶" : "sharp";
  const color = (v: string) => (v === "sharp" ? K.sage : v === "breaks rules" || v === "author failed" ? K.clay : K.sig);
  const caseRank = (r: Row) => {
    if (r.state === "error") return 0;
    if (!r.result) return 9;
    const vs = r.result.questions.map(verdict);
    return vs.every((v) => v === "sharp") ? 5 : vs.some((v) => v === "breaks rules" || v === "author failed") ? 1 : 2;
  };
  const sorted = [...rows].sort((a, b) => caseRank(a) - caseRank(b));

  function copyResults() {
    const lines = [
      `Quiz question check: ${done.length}/${rows.length} cases, ${s.questions} questions`,
      `sharp ${s.sharp} (${p(s.sharp)}) · author passes ${p(s.authorPass)} · bluffer caught ${p(s.bluffCaught)} · rules ok ${p(s.rulesOk)} · key in paragraph ${p(s.grounded)} · on AI text ${s.onAi}`,
      "",
      ...sorted.flatMap((r) =>
        r.state === "error"
          ? [`ERR ${r.id}: ${r.error}`]
          : (r.result?.questions ?? [])
              .filter((q) => verdict(q) !== "sharp")
              .map((q) => `${r.id} [${verdict(q)}] ${q.question} | key: ${q.answer_key} | bluffer: ${q.bluffAnswer}${q.problems.length ? ` | ${q.problems.join(" ")}` : ""}`)
      ),
    ];
    navigator.clipboard.writeText(lines.join("\n")).then(
      () => toast("Results copied. Paste them into the chat."),
      () => toast("Couldn't copy.", "error")
    );
  }

  return (
    <Cell label={`quiz question check · ${QUESTION_CASES.length} cases`} refId="B3" id="question-check">
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginBottom: 10 }}>
        <Btn primary onClick={() => void run()} disabled={running}>
          {running ? `running ${done.length + errored.length}/${rows.length}` : "run question check"}
        </Btn>
        {errored.length > 0 && !running && <Btn onClick={() => void run(errored.map((r) => r.id))}>retry {errored.length} errored</Btn>}
        {done.length > 0 && <Btn onClick={copyResults}>copy results</Btn>}
        {savedAt && <span style={{ fontFamily: K.mono, fontSize: 12, color: K.sage }}>showing run from {savedAt}</span>}
        <span style={{ fontFamily: K.mono, fontSize: 12, color: K.mute }}>
          writes the 2 questions for each case, then a student who did the work and one who only knows the topic answer them. ~150 calls, about $0.50.
        </span>
      </div>

      {s.questions > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 18px", fontFamily: K.mono, fontSize: 12, marginBottom: 10 }}>
          <span>{done.length}/{rows.length} cases · {s.questions} questions</span>
          <span style={{ color: K.sage }}>sharp {s.sharp} ({p(s.sharp)})</span>
          <span style={{ color: s.authorPass < s.questions ? K.clay : K.sage }}>author passes {p(s.authorPass)}</span>
          <span style={{ color: K.fg }}>bluffer caught {p(s.bluffCaught)}</span>
          <span style={{ color: s.rulesOk < s.questions ? K.sig : K.mute }}>rules ok {p(s.rulesOk)}</span>
          <span style={{ color: s.grounded < s.questions ? K.sig : K.mute }}>key in paragraph {p(s.grounded)}</span>
          <span style={{ color: s.onAi ? K.sig : K.mute }}>asked about AI text {s.onAi}</span>
          <span style={{ color: K.mute }}>{usd(cost)}</span>
        </div>
      )}

      <div style={{ overflowX: "auto" }}>
        <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 560 }}>
          <thead>
            <tr>
              <th style={th}>case</th>
              <th style={th}>scenario</th>
              <th style={th}>q1</th>
              <th style={th}>q2</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => {
              const c = QUESTION_CASES.find((x) => x.id === r.id)!;
              const qs = r.result?.questions ?? [];
              return (
                <Fragment key={r.id}>
                  <tr onClick={() => r.result && setOpen(open === r.id ? null : r.id)} style={{ cursor: r.result ? "pointer" : "default" }}>
                    <td style={tdMono}>{r.id}</td>
                    <td style={td}>{c.scenario}</td>
                    {[0, 1].map((i) => (
                      <td key={i} style={{ ...tdMono, color: r.state === "error" ? K.clay : qs[i] ? color(verdict(qs[i])) : K.mute }}>
                        {r.state === "running" ? "running…" : r.state === "error" ? (i === 0 ? r.error : "") : qs[i] ? verdict(qs[i]) : "—"}
                      </td>
                    ))}
                  </tr>
                  {open === r.id && r.result && (
                    <tr>
                      <td colSpan={4} style={{ ...td, fontSize: 12, lineHeight: 1.5 }}>
                        <div style={{ color: K.mute, marginBottom: 4 }}>{c.course}</div>
                        {qs.map((q, i) => (
                          <div key={i} style={{ marginBottom: 6 }}>
                            <div><strong>Q{i + 1} (¶{q.paragraph}):</strong> {q.question}</div>
                            <div style={{ color: K.mute }}>Key: {q.answer_key}</div>
                            <div><span style={{ color: q.authorOk ? K.sage : K.clay }}>{q.authorOk ? "✓" : "✗"} author:</span> {q.authorAnswer}</div>
                            <div><span style={{ color: q.bluffOk ? K.clay : K.sage }}>{q.bluffOk ? "passed ✗" : "caught ✓"} bluffer:</span> {q.bluffAnswer}</div>
                            {q.problems.length > 0 && <div style={{ color: K.clay }}>{q.problems.join(" ")}</div>}
                          </div>
                        ))}
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
