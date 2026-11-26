"use client";

import { RulesCheck } from "./RulesCheck";
import { POLICY_CASES as SYNTHETIC_POLICIES } from "@/src/lib/eval/policies";
import { REAL_POLICY_CASES } from "@/src/lib/eval/policies-real";
const POLICY_CASES = [...REAL_POLICY_CASES, ...SYNTHETIC_POLICIES];
import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { K, Cell, Btn, Header, Grid, th, td, tdMono, Loading, usd, Bar } from "../ui";
import { toast } from "@/src/components/Toaster";
import { ContributionMapView } from "@/src/components/ContributionMapView";
import type { ScoreCard } from "@/src/lib/scoring";
import type { QuizResult } from "@/src/lib/quiz";
import type { CaseResult } from "@/src/lib/eval/run-case";

type Mode = "good" | "vague" | "custom";
type Level = "none" | "ideas" | "heavy" | "written";
type CaseInfo = {
  id: string;
  course: string;
  scenario: string;
  expect: "review" | "no_review" | "either";
  expectReliance: Level | null;
  syllabus?: string;
  instructions?: string;
  transcript?: string;
  submission?: string;
  student?: "knows_work" | "vague";
};
type Analysis = {
  quiz: QuizResult;
  answers?: string[];
  comprehension?: { passed: boolean; note: string };
  card?: ScoreCard;
  needsAnswers: boolean;
  costUsd: number;
  calls: number;
  ms: number;
};
type Row = { info: CaseInfo; state: "idle" | "running" | "done" | "error"; result?: CaseResult; error?: string };
type Filter = "all" | "wrong" | "borderline" | "reliance" | "errors";

const RANK: Record<Level, number> = { none: 0, ideas: 1, heavy: 2, written: 3 };
const LEVEL_COLOR: Record<Level, string> = { none: K.mute, ideas: "#B9A6E0", heavy: K.sig, written: K.clay };
const CONCURRENCY = 3;
const EST_PER_CASE = 0.07;

const area: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  resize: "vertical",
  background: K.bg,
  color: K.fg,
  border: `1px solid ${K.line}`,
  borderRadius: 0,
  padding: "10px 12px",
  fontFamily: K.mono,
  fontSize: 12.5,
  lineHeight: 1.6,
};
const fieldLabel: React.CSSProperties = { display: "flex", justifyContent: "space-between", gap: 8, fontFamily: K.mono, fontSize: 11, color: K.mute };

export default function LabClient() {
  // ---------------- playground
  const [syllabus, setSyllabus] = useState("");
  const [transcript, setTranscript] = useState("");
  const [submission, setSubmission] = useState("");
  const [mode, setMode] = useState<Mode>("good");
  const [customAnswers, setCustomAnswers] = useState<string[]>([]);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [labError, setLabError] = useState<string | null>(null);
  const [showRaw, setShowRaw] = useState(false);
  const [showTeacher, setShowTeacher] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [saveExpect, setSaveExpect] = useState<"review" | "no_review" | "either">("either");
  const [saveReliance, setSaveReliance] = useState<Level | "">("");

  // ---------------- test set
  const [rows, setRows] = useState<Row[]>([]);
  const [running, setRunning] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const [savedRunAt, setSavedRunAt] = useState<string | null>(null);

  const loadCases = useCallback(async () => {
    const res = await fetch("/api/admin/eval?full=1");
    if (!res.ok) return;
    const d = await res.json();
    setRows((d.cases as CaseInfo[]).map((info) => ({ info, state: "idle" })));
  }, []);

  useEffect(() => {
    void loadCases();
  }, [loadCases]);

  const words = (t: string) => (t.trim() ? t.trim().split(/\s+/).length : 0);
  const paraCount = (t: string) => t.split(/\n\s*\n/).filter((p) => p.trim()).length;
  const looksChatGPT = /^\s*(You said|ChatGPT said)\s*:/im.test(transcript);
  const looksLabeled = /^\s*(User|Assistant|You|ChatGPT|Claude|AI)\s*:/im.test(transcript);

  function loadPreset(id: string) {
    const pol = POLICY_CASES.find((p) => p.id === id);
    if (pol) {
      // Syllabus only: paste a transcript and submission to test against it.
      setSyllabus(`${pol.policy}\n\n${pol.assignment.title}\n${pol.assignment.instructions}`);
      setAnalysis(null);
      setLabError(null);
      setSaveName(`${pol.discipline}: `);
      toast(`Loaded ${pol.course} (${pol.tier}). ${pol.quirk ?? ""}`, "info");
      return;
    }
    const c = rows.find((r) => r.info.id === id)?.info;
    if (!c) return;
    setSyllabus([c.syllabus, c.instructions].filter(Boolean).join("\n\n"));
    setTranscript(c.transcript ?? "");
    setSubmission(c.submission ?? "");
    setMode(c.student === "vague" ? "vague" : "good");
    setAnalysis(null);
    setLabError(null);
    setSaveName(c.scenario);
    setSaveExpect(c.expect);
    setSaveReliance(c.expectReliance ?? "");
    toast(`Loaded ${c.id}: ${c.scenario}`, "info");
  }

  function clearLab() {
    setSyllabus("");
    setTranscript("");
    setSubmission("");
    setMode("good");
    setCustomAnswers([]);
    setAnalysis(null);
    setLabError(null);
    setShowRaw(false);
    setShowTeacher(false);
    setSaveOpen(false);
  }

  async function analyze(withAnswers = false) {
    setAnalyzing(true);
    setLabError(null);
    if (!withAnswers) {
      setShowRaw(false);
      setShowTeacher(false);
      setSaveOpen(false);
    }
    try {
      const res = await fetch("/api/admin/lab/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          syllabus,
          transcript,
          submission,
          mode,
          ...(withAnswers && analysis ? { quiz: analysis.quiz, answers: customAnswers } : {}),
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setLabError(d.error ?? "Analysis failed.");
        return;
      }
      if (withAnswers && analysis) d.costUsd += analysis.costUsd;
      setAnalysis(d);
      if (d.needsAnswers) setCustomAnswers(d.quiz.quiz.map(() => ""));
      if (d.card) {
        const top = d.card.reliance.paragraphs.reduce((b: Level, p: { level: Level }) => (RANK[p.level] > RANK[b] ? p.level : b), "none");
        setSaveExpect(d.card.needsReview ? "review" : "no_review");
        setSaveReliance(top);
      }
    } catch {
      setLabError("Couldn't reach the server.");
    } finally {
      setAnalyzing(false);
    }
  }

  async function saveCase(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/admin/lab/cases", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: saveName,
        syllabus,
        transcript,
        submission,
        student: mode === "vague" ? "vague" : "knows_work",
        expect: saveExpect,
        expectReliance: saveReliance || null,
      }),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) return toast(d.error ?? "Couldn't save the case.", "error");
    toast(`Saved as test case lab-${d.case.id}. It's now part of the test set.`);
    setSaveOpen(false);
    await loadCases();
  }

  async function deleteSaved(id: string) {
    const n = id.replace("lab-", "");
    const res = await fetch(`/api/admin/lab/cases/${n}`, { method: "DELETE" });
    if (!res.ok) return toast("Couldn't delete that case.", "error");
    toast(`Deleted ${id}.`);
    setRows((prev) => prev.filter((r) => r.info.id !== id));
  }

  // ---------------- test set runner
  async function runSet(ids?: string[]) {
    setRunning(true);
    setSavedRunAt(null);
    const targets = ids ?? rows.map((r) => r.info.id);
    setRows((prev) => prev.map((r) => (targets.includes(r.info.id) ? { info: r.info, state: "idle" } : r)));
    const queue = [...targets];
    const collected = new Map<string, Row>();
    async function worker() {
      while (queue.length) {
        const id = queue.shift()!;
        setRows((prev) => prev.map((r) => (r.info.id === id ? { ...r, state: "running" } : r)));
        let res = await fetch(`/api/admin/eval/${id}`, { method: "POST" }).catch(() => null);
        if (res && !res.ok && res.status !== 401 && res.status !== 404) {
          await new Promise((r) => setTimeout(r, 3000)); // one retry for transient AI errors
          res = await fetch(`/api/admin/eval/${id}`, { method: "POST" }).catch(() => null);
        }
        const d = res ? await res.json().catch(() => ({})) : {};
        setRows((prev) =>
          prev.map((r) => {
            if (r.info.id !== id) return r;
            const next: Row = res?.ok ? { ...r, state: "done", result: d.result } : { ...r, state: "error", error: d.error ?? "request failed" };
            collected.set(id, next);
            return next;
          })
        );
      }
    }
    await Promise.all(Array.from({ length: CONCURRENCY }, worker));
    setRunning(false);

    // Save full runs to the model-quality history.
    if (!ids) {
      const all = [...collected.values()];
      const done = all.filter((r) => r.state === "done" && r.result);
      const judged = done.filter((r) => r.result!.correct !== null);
      const rel = done.filter((r) => r.result!.relianceCorrect !== null);
      const summary = {
        total: all.length,
        judged: judged.length,
        correct: judged.filter((r) => r.result!.correct).length,
        relianceJudged: rel.length,
        relianceCorrect: rel.filter((r) => r.result!.relianceCorrect).length,
        borderline: done.length - judged.length,
        errors: all.filter((r) => r.state === "error").length,
        costUsd: done.reduce((s, r) => s + (r.result!.costUsd ?? 0), 0),
        misses: done.filter((r) => r.result!.correct === false || r.result!.relianceCorrect === false).map((r) => r.info.id),
      };
      const saved = await fetch("/api/admin/eval/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(summary),
      });
      if (saved.ok) {
        setSavedRunAt(new Date().toLocaleTimeString());
        toast(`Run saved: ${summary.correct}/${summary.judged} decisions, ${summary.relianceCorrect}/${summary.relianceJudged} labels.`);
      }
    }
  }

  const done = rows.filter((r) => r.state === "done" && r.result);
  const judged = done.filter((r) => r.result!.correct !== null);
  const correct = judged.filter((r) => r.result!.correct).length;
  const rel = done.filter((r) => r.result!.relianceCorrect !== null);
  const relOk = rel.filter((r) => r.result!.relianceCorrect).length;
  const errored = rows.filter((r) => r.state === "error");
  const finished = rows.filter((r) => r.state === "done" || r.state === "error").length;
  const spent = done.reduce((s, r) => s + (r.result!.costUsd ?? 0), 0);

  const visible = useMemo(
    () =>
      rows.filter((r) => {
        const res = r.result;
        if (filter === "wrong") return res?.correct === false;
        if (filter === "borderline") return res && res.correct === null;
        if (filter === "reliance") return res?.relianceCorrect === false;
        if (filter === "errors") return r.state === "error";
        return true;
      }),
    [rows, filter]
  );

  async function copyResults() {
    const lines = [
      `Luminatra test set — accuracy ${correct}/${judged.length}, reliance labels ${relOk}/${rel.length}, errors ${errored.length}, cost ${usd(spent)}`,
    ];
    for (const r of rows) {
      const res = r.result;
      if (!res) {
        lines.push(`${r.state === "error" ? "ERR" : "--"} ${r.info.id} ${r.error ?? ""}`);
        continue;
      }
      lines.push(
        `${res.correct === null ? "~" : res.correct ? "ok" : "XX"} ${res.id} score ${res.card.score} [c${res.card.signals.comprehension.points} r${res.card.signals.reliance.points} p${res.card.signals.policy.points}] expect ${res.expect} got ${res.actual} | reliance ${res.relianceExpected ?? "-"}/${res.relianceActual}${res.relianceCorrect === false ? " XX" : ""}`
      );
      if (res.correct === false || res.relianceCorrect === false) {
        for (const p of res.card.reliance.paragraphs) lines.push(`    ¶${p.index} ${p.level}${p.disclosed ? " (disclosed)" : ""} [${p.evidence}] ${p.note}`);
        res.quiz.quiz.forEach((q, i) => lines.push(`    Q${i + 1}: ${q.question}`, `    A${i + 1}: ${res.answers[i]}`));
      }
    }
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      toast("Results copied.");
    } catch {
      toast("Couldn't copy automatically.", "error");
    }
  }

  const card = analysis?.card;
  const seg = (m: Mode, label: string) => (
    <button
      key={m}
      type="button"
      aria-pressed={mode === m}
      onClick={() => setMode(m)}
      style={{ fontFamily: K.mono, fontSize: 12, padding: "8px 12px", minHeight: 36, border: "none", borderRadius: 0, background: mode === m ? K.sig : "transparent", color: mode === m ? K.bg : K.fg, cursor: "pointer" }}
    >
      {label}
    </button>
  );
  const chip = (f: Filter, label: string) => (
    <button
      key={f}
      type="button"
      aria-pressed={filter === f}
      onClick={() => setFilter(f)}
      style={{ fontFamily: K.mono, fontSize: 12, padding: "6px 10px", minHeight: 32, border: `1px solid ${K.line}`, borderRadius: 0, background: filter === f ? K.fg : K.bg, color: filter === f ? K.bg : K.fg, cursor: "pointer" }}
    >
      {label}
    </button>
  );
  const builtIn = rows.filter((r) => !r.info.id.startsWith("lab-"));
  const saved = rows.filter((r) => r.info.id.startsWith("lab-"));

  return (
    <>
      <Header sheet="sheet 02 / test lab" title="Test lab">
        <label htmlFor="preset" style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>Load a preset</label>
        <select
          id="preset"
          value=""
          onChange={(e) => e.target.value && loadPreset(e.target.value)}
          style={{ fontFamily: K.mono, fontSize: 13, color: K.fg, background: K.bg, border: `1px solid ${K.fg}`, borderRadius: 0, padding: "9px 10px", minHeight: 40, maxWidth: 280 }}
        >
          <option value="">load preset…</option>
          {saved.length > 0 && (
            <optgroup label="Saved from lab">
              {saved.map((r) => <option key={r.info.id} value={r.info.id}>{r.info.id} · {r.info.scenario}</option>)}
            </optgroup>
          )}
          <optgroup label={`Real course policies (${REAL_POLICY_CASES.length}, syllabus only)`}>
            {REAL_POLICY_CASES.map((p) => <option key={p.id} value={p.id}>{p.discipline} · {p.tier} · {p.course.split(" · ").slice(0, 2).join(" · ")}</option>)}
          </optgroup>
          <optgroup label={`Written examples (${SYNTHETIC_POLICIES.length}, syllabus only)`}>
            {SYNTHETIC_POLICIES.map((p) => <option key={p.id} value={p.id}>{p.discipline} · {p.tier} · {p.course}</option>)}
          </optgroup>
          <optgroup label="Built-in test set">
            {builtIn.map((r) => <option key={r.info.id} value={r.info.id}>{r.info.id} · {r.info.scenario}</option>)}
          </optgroup>
        </select>
        <Btn onClick={clearLab}>clear</Btn>
      </Header>

      <p style={{ margin: 0, maxWidth: 760, fontSize: 14, lineHeight: 1.6, color: K.mute }}>
        Run the real model on anything without creating a class or a student. Nothing here reaches a teacher. Runs use real API credit and show under spending as <span style={{ fontFamily: K.mono, color: K.fg }}>lab</span>.
      </p>

      <Grid min={460}>
        <Cell label="input" refId="A1">
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label htmlFor="lab-syllabus" style={fieldLabel}><span>syllabus ai policy</span><span>{words(syllabus)} words</span></label>
              <textarea id="lab-syllabus" rows={4} value={syllabus} onChange={(e) => setSyllabus(e.target.value)} placeholder="AI policy: You may use AI to brainstorm…" style={area} />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label htmlFor="lab-transcript" style={fieldLabel}>
                <span>ai transcript</span>
                <span style={{ color: transcript ? (looksChatGPT || looksLabeled ? K.sage : K.sig) : K.mute }}>
                  {!transcript ? "optional" : looksChatGPT ? "chatgpt export format" : looksLabeled ? "speakers labeled" : "speakers not labeled"}
                </span>
              </label>
              <textarea id="lab-transcript" rows={7} value={transcript} onChange={(e) => setTranscript(e.target.value)} placeholder={"You said:\n…\nChatGPT said:\n…"} style={area} />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label htmlFor="lab-submission" style={fieldLabel}><span>submitted work</span><span>{paraCount(submission)} ¶ · {words(submission)} words</span></label>
              <textarea id="lab-submission" rows={8} value={submission} onChange={(e) => setSubmission(e.target.value)} placeholder="Paste the paper. Separate paragraphs with a blank line." style={area} />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span style={fieldLabel}>simulated student on the quiz</span>
              <div role="group" aria-label="Simulated student" style={{ display: "inline-flex", flexWrap: "wrap", border: `1px solid ${K.line}`, alignSelf: "flex-start" }}>
                {seg("good", "answers well")}
                {seg("vague", "answers vaguely")}
                {seg("custom", "i'll type answers")}
              </div>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12 }}>
              <Btn primary onClick={() => analyze(false)} disabled={analyzing || !syllabus.trim() || !submission.trim()}>
                {analyzing ? "analyzing…" : "analyze"}
              </Btn>
              <span style={{ fontFamily: K.mono, fontSize: 12, color: K.mute }}>≈ $0.06 · 2–3 claude calls · ~30 s</span>
            </div>
            {labError && <div style={{ fontFamily: K.mono, fontSize: 12, color: K.clay }}>{labError}</div>}
          </div>
        </Cell>

        <Cell label="result" refId="A2">
          {!analysis && !analyzing && <div style={{ fontFamily: K.mono, fontSize: 13, color: K.mute }}>load a preset or paste inputs, then analyze</div>}
          {analyzing && <Loading what="running the analyzer, quiz and grader" />}

          {analysis?.needsAnswers && !analyzing && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ fontSize: 14, color: K.mute }}>Answer the quiz as the student would, then grade.</div>
              {analysis.quiz.quiz.map((q, i) => (
                <div key={i} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <label htmlFor={`ans-${i}`} style={{ fontSize: 14 }}>Q{i + 1}. {q.question}</label>
                  <input id={`ans-${i}`} value={customAnswers[i] ?? ""} onChange={(e) => setCustomAnswers((a) => a.map((x, j) => (j === i ? e.target.value : x)))} style={{ ...area, resize: "none" }} />
                </div>
              ))}
              <div><Btn primary onClick={() => analyze(true)} disabled={customAnswers.some((a) => !a.trim())}>grade answers</Btn></div>
            </div>
          )}

          {card && !analyzing && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontFamily: K.mono, fontSize: 11, color: K.mute }}>
                <span>{card.version} · {(analysis!.ms / 1000).toFixed(1)} s · {analysis!.calls} calls</span>
                <span>{usd(analysis!.costUsd, 3)}</span>
              </div>
              <div style={{ display: "flex", alignItems: "flex-end", gap: 16, flexWrap: "wrap" }}>
                <span style={{ fontFamily: K.mono, fontSize: 72, lineHeight: 0.9, color: card.needsReview ? K.sig : K.fg }}>{card.score}</span>
                <span style={{ paddingBottom: 6 }}>
                  <span style={{ display: "block", fontFamily: K.mono, fontSize: 12, color: K.mute }}>/100 follow-up priority</span>
                  <span style={{ display: "block", fontSize: 15, marginTop: 4, color: card.needsReview ? K.clay : K.sage }}>
                    {card.needsReview ? "Would go to teacher review" : "Would not be flagged"}
                  </span>
                </span>
              </div>
              <div>
                {(["comprehension", "reliance", "policy"] as const).map((k) => {
                  const sig = card.signals[k];
                  return (
                    <div key={k} style={{ padding: "10px 0", borderTop: `1px solid ${K.line}` }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
                        <span>{k === "reliance" ? "AI reliance" : k === "policy" ? "Syllabus rules" : "Comprehension"}</span>
                        <span style={{ fontFamily: K.mono, color: sig.points ? K.sig : K.mute }}>{sig.points}/{sig.max}</span>
                      </div>
                      <div style={{ marginTop: 6 }}><Bar value={sig.points} max={sig.max} /></div>
                      <div style={{ fontSize: 13, color: K.mute, marginTop: 6, lineHeight: 1.5 }}>{sig.reason || "nothing notable"}</div>
                    </div>
                  );
                })}
              </div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", minWidth: 420, borderCollapse: "collapse" }}>
                  <thead><tr><th scope="col" style={th}>¶</th><th scope="col" style={th}>reliance</th><th scope="col" style={th}>note</th><th scope="col" style={th}>keys · phrases</th></tr></thead>
                  <tbody>
                    {card.reliance.paragraphs.map((p) => (
                      <tr key={p.index}>
                        <td style={tdMono}>{p.index}</td>
                        <td style={{ ...tdMono, color: LEVEL_COLOR[p.level] }}>{p.level}{p.disclosed ? " · disclosed" : ""}{p.adjustedFrom ? ` (was ${p.adjustedFrom})` : ""}</td>
                        <td style={{ ...td, color: K.mute }}>{p.note || "—"}</td>
                        <td style={tdMono}>{p.keywordShare != null ? `${Math.round(p.keywordShare * 100)}% · ${Math.round((p.phraseShare ?? 0) * 100)}%` : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {analysis!.answers && (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {analysis!.quiz.quiz.map((q, i) => (
                    <div key={i} style={{ fontSize: 13, lineHeight: 1.5 }}>
                      <div style={{ color: K.mute }}>Q{i + 1}. {q.question}</div>
                      <div>A. {analysis!.answers![i]}</div>
                    </div>
                  ))}
                </div>
              )}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                <Btn onClick={() => setSaveOpen((v) => !v)}>save as test case</Btn>
                <Btn onClick={() => setShowRaw((v) => !v)}>{showRaw ? "hide raw" : "view raw analysis"}</Btn>
                <Btn onClick={() => setShowTeacher((v) => !v)}>{showTeacher ? "hide teacher view" : "teacher view"}</Btn>
              </div>
              {saveOpen && (
                <form onSubmit={saveCase} style={{ display: "flex", flexDirection: "column", gap: 10, border: `1px solid ${K.line}`, padding: 12 }}>
                  <label htmlFor="save-name" style={fieldLabel}>case name</label>
                  <input id="save-name" required value={saveName} onChange={(e) => setSaveName(e.target.value)} style={{ ...area, resize: "none" }} />
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
                    <label style={{ ...fieldLabel, flexDirection: "column", alignItems: "flex-start" }}>
                      correct decision
                      <select value={saveExpect} onChange={(e) => setSaveExpect(e.target.value as typeof saveExpect)} style={{ ...area, padding: "8px 10px", width: "auto" }}>
                        <option value="review">review</option>
                        <option value="no_review">no review</option>
                        <option value="either">either (borderline)</option>
                      </select>
                    </label>
                    <label style={{ ...fieldLabel, flexDirection: "column", alignItems: "flex-start" }}>
                      correct reliance (highest ¶)
                      <select value={saveReliance} onChange={(e) => setSaveReliance(e.target.value as Level | "")} style={{ ...area, padding: "8px 10px", width: "auto" }}>
                        <option value="">don&apos;t grade</option>
                        <option value="none">none</option>
                        <option value="ideas">ideas</option>
                        <option value="heavy">heavy</option>
                        <option value="written">written</option>
                      </select>
                    </label>
                  </div>
                  <div style={{ fontSize: 12, color: K.mute }}>Pre-filled with what the model decided. Change them to the right answer if it got it wrong.</div>
                  <div><Btn type="submit" primary>save to test set</Btn></div>
                </form>
              )}
              {showRaw && (
                <pre style={{ margin: 0, maxHeight: 360, overflow: "auto", background: K.bg, border: `1px solid ${K.line}`, padding: 12, fontFamily: K.mono, fontSize: 11.5, lineHeight: 1.5, color: K.fg, whiteSpace: "pre-wrap" }}>
                  {JSON.stringify({ analysis: analysis!.quiz, comprehension: analysis!.comprehension, scoreCard: { ...card, contribution: undefined } }, null, 2)}
                </pre>
              )}
              {showTeacher && (
                <div style={{ background: "#F7F5F0", color: "#1E2230", padding: 12, fontFamily: "system-ui, sans-serif", fontSize: 14 }}>
                  <div style={{ fontFamily: K.mono, fontSize: 11, color: "#6B7080", marginBottom: 8 }}>what the teacher sees</div>
                  <ContributionMapView map={card.contribution} reliance={card.reliance} text={submission} />
                </div>
              )}
            </div>
          )}
        </Cell>
      </Grid>

      <RulesCheck />

      <Cell label="test set" refId="B1" id="test-set">
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <div style={{ fontSize: 14, color: K.mute }}>
            {rows.length} cases ({saved.length} saved from the lab). About {usd(rows.length * EST_PER_CASE)} per full run.
            {savedRunAt && <span style={{ color: K.sage }}> Run saved to model quality at {savedRunAt}.</span>}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {errored.length > 0 && !running && <Btn onClick={() => runSet(errored.map((r) => r.info.id))}>retry {errored.length} errored</Btn>}
            <Btn onClick={copyResults} disabled={!done.length}>copy results</Btn>
            <Btn primary onClick={() => runSet()} disabled={running || !rows.length}>{running ? `running ${finished}/${rows.length}…` : `run all ${rows.length}`}</Btn>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(160px, 100%), 1fr))", gap: 0, marginTop: 16, borderTop: `1px solid ${K.line}`, borderBottom: `1px solid ${K.line}` }}>
          {[
            ["progress", `${finished}/${rows.length}`, K.fg],
            ["decisions", judged.length ? `${correct}/${judged.length}` : "—", judged.length && correct === judged.length ? K.sage : K.fg],
            ["reliance labels", rel.length ? `${relOk}/${rel.length}` : "—", rel.length && relOk === rel.length ? K.sage : K.fg],
            ["borderline · errors", `${done.length - judged.length} · ${errored.length}`, errored.length ? K.clay : K.fg],
            ["spent", usd(spent), K.fg],
          ].map(([l, v, c], i) => (
            <div key={l} style={{ padding: "12px 14px", borderLeft: i ? `1px solid ${K.line}` : "none" }}>
              <div style={{ fontFamily: K.mono, fontSize: 11, color: K.mute }}>{l}</div>
              <div style={{ fontFamily: K.mono, fontSize: 22, marginTop: 6, color: c }}>{v}</div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 0 }}><Bar value={finished} max={Math.max(1, rows.length)} /></div>

        <div role="group" aria-label="Filter cases" style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 14 }}>
          {chip("all", `all ${rows.length}`)}
          {chip("wrong", `wrong ${judged.length - correct}`)}
          {chip("borderline", `borderline ${done.length - judged.length}`)}
          {chip("reliance", `reliance misses ${rel.length - relOk}`)}
          {chip("errors", `errors ${errored.length}`)}
        </div>

        <div style={{ overflowX: "auto", marginTop: 10 }}>
          <table style={{ width: "100%", minWidth: 820, borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th scope="col" style={th}>·</th>
                <th scope="col" style={th}>case</th>
                <th scope="col" style={th}>scenario</th>
                <th scope="col" style={th}>decision exp → got</th>
                <th scope="col" style={th}>reliance exp → got</th>
                <th scope="col" style={{ ...th, textAlign: "right" }}>score</th>
                <th scope="col" style={th}><span style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>actions</span></th>
              </tr>
            </thead>
            <tbody>
              {visible.map((r) => {
                const res = r.result;
                const mark =
                  r.state === "running" ? <span style={{ color: K.sig }}>…</span>
                  : r.state === "error" ? <span style={{ color: K.clay }}>!</span>
                  : !res ? <span style={{ color: K.mute }}>·</span>
                  : res.correct === false || res.relianceCorrect === false ? <span style={{ color: K.clay }}>✗</span>
                  : res.correct === null ? <span style={{ color: K.mute }}>~</span>
                  : <span style={{ color: K.sage }}>✓</span>;
                const open = openId === r.info.id;
                return (
                  <Fragment key={r.info.id}>
                    <tr>
                      <td style={tdMono}>{mark}</td>
                      <td style={{ ...tdMono, whiteSpace: "nowrap" }}>
                        <button type="button" onClick={() => setOpenId(open ? null : r.info.id)} disabled={!res && !r.error} aria-expanded={open} style={{ background: "none", border: "none", padding: 0, color: res || r.error ? K.sig : K.fg, fontFamily: K.mono, fontSize: 12, cursor: res || r.error ? "pointer" : "default" }}>
                          {r.info.id}
                        </button>
                      </td>
                      <td style={td}>{r.info.scenario}</td>
                      <td style={{ ...tdMono, color: K.mute, whiteSpace: "nowrap" }}>{r.info.expect.replace("_", " ")} → <span style={{ color: res?.correct === false ? K.clay : K.fg }}>{res ? res.actual.replace("_", " ") : "—"}</span></td>
                      <td style={{ ...tdMono, color: K.mute, whiteSpace: "nowrap" }}>{r.info.expectReliance ?? "—"} → <span style={{ color: res?.relianceCorrect === false ? K.clay : K.fg }}>{res ? res.relianceActual : "—"}</span></td>
                      <td style={{ ...tdMono, textAlign: "right" }}>{res ? res.card.score : "—"}</td>
                      <td style={{ ...tdMono, whiteSpace: "nowrap" }}>
                        <button type="button" onClick={() => { loadPreset(r.info.id); window.scrollTo({ top: 0, behavior: "smooth" }); }} style={{ background: "none", border: "none", padding: 0, color: K.mute, fontFamily: K.mono, fontSize: 12, cursor: "pointer" }}>open in lab</button>
                        {r.info.id.startsWith("lab-") && (
                          <button type="button" onClick={() => deleteSaved(r.info.id)} style={{ background: "none", border: "none", padding: "0 0 0 10px", color: K.clay, fontFamily: K.mono, fontSize: 12, cursor: "pointer" }}>delete</button>
                        )}
                      </td>
                    </tr>
                    {open && (
                      <tr>
                        <td colSpan={7} style={{ ...td, background: K.bg, color: K.mute, lineHeight: 1.6 }}>
                          {r.error && <div style={{ color: K.clay }}>error: {r.error}</div>}
                          {res && (
                            <>
                              <div>{res.course} — {res.why}</div>
                              {(["comprehension", "reliance", "policy"] as const).map((k) => (
                                <div key={k}><span style={{ color: K.fg }}>{k} {res.card.signals[k].points}/{res.card.signals[k].max}:</span> {res.card.signals[k].reason || "nothing notable"}</div>
                              ))}
                              <div><span style={{ color: K.fg }}>paragraphs:</span> {res.card.reliance.paragraphs.map((p) => `¶${p.index} ${p.level}${p.disclosed ? " (disclosed)" : ""}`).join(" · ")}</div>
                              {res.quiz.quiz.map((q, i) => <div key={i}>Q{i + 1}. {q.question} — <span style={{ color: K.fg }}>{res.answers[i]}</span></div>)}
                            </>
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
    </>
  );
}
