"use client";

import { useCallback, useEffect, useState } from "react";
import { colors } from "@/src/components/ReviewCard";
import type { CaseResult } from "@/src/lib/eval/run-case";

type CaseInfo = { id: string; course: string; scenario: string; expect: "review" | "no_review" | "either" };
type Scoring = { version: string; weights: { textMatch: number; policy: number; comprehension: number }; threshold: number };
type Row = { info: CaseInfo; state: "idle" | "running" | "done" | "error"; result?: CaseResult; error?: string };

const CONCURRENCY = 3;

export default function AdminClient() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [scoring, setScoring] = useState<Scoring | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [running, setRunning] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/eval");
    if (res.status === 401) {
      setAuthed(false);
      return;
    }
    const data = await res.json();
    setScoring(data.scoring);
    setRows((data.cases as CaseInfo[]).map((info) => ({ info, state: "idle" })));
    setAuthed(true);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function login(e: React.FormEvent) {
    e.preventDefault();
    setLoginError(null);
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setLoginError(data.error ?? "Couldn't sign in.");
      return;
    }
    setPassword("");
    await load();
  }

  async function runAll(onlyIds?: string[]) {
    setRunning(true);
    const ids = onlyIds ?? rows.map((r) => r.info.id);
    setRows((prev) =>
      prev.map((r) => (ids.includes(r.info.id) ? { info: r.info, state: "idle" } : r))
    );
    const queue = [...ids];
    async function worker() {
      while (queue.length) {
        const id = queue.shift()!;
        setRows((prev) => prev.map((r) => (r.info.id === id ? { ...r, state: "running" } : r)));
        try {
          const res = await fetch(`/api/admin/eval/${id}`, { method: "POST" });
          const data = await res.json().catch(() => ({}));
          setRows((prev) =>
            prev.map((r) =>
              r.info.id === id
                ? res.ok
                  ? { ...r, state: "done", result: data.result }
                  : { ...r, state: "error", error: data.error ?? `HTTP ${res.status}` }
                : r
            )
          );
        } catch (err) {
          setRows((prev) =>
            prev.map((r) => (r.info.id === id ? { ...r, state: "error", error: String(err) } : r))
          );
        }
      }
    }
    await Promise.all(Array.from({ length: CONCURRENCY }, worker));
    setRunning(false);
  }

  const done = rows.filter((r) => r.state === "done" && r.result);
  const judged = done.filter((r) => r.result!.correct !== null);
  const correct = judged.filter((r) => r.result!.correct).length;
  const fp = judged.filter((r) => r.info.expect === "no_review" && r.result!.actual === "review");
  const fn = judged.filter((r) => r.info.expect === "review" && r.result!.actual === "no_review");
  const errored = rows.filter((r) => r.state === "error");
  const finished = rows.filter((r) => r.state === "done" || r.state === "error").length;

  const shell = (children: React.ReactNode) => (
    <main
      style={{
        minHeight: "calc(100vh - 57px)",
        background: colors.bg,
        fontFamily: "var(--font-sans), system-ui, sans-serif",
        color: colors.ink,
        padding: "40px 20px 80px",
      }}
    >
      <div style={{ maxWidth: 900, margin: "0 auto", display: "flex", flexDirection: "column", gap: 20 }}>
        <div>
          <div
            style={{
              fontSize: 13,
              fontWeight: 600,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: colors.accent,
            }}
          >
            Admin
          </div>
          <h1 style={{ margin: "4px 0 0", fontSize: 26, fontWeight: 600 }}>Model test set</h1>
        </div>
        {children}
      </div>
    </main>
  );

  if (authed === null) return shell(<div style={{ color: colors.muted }}>Loading...</div>);

  if (!authed) {
    return shell(
      <form
        onSubmit={login}
        style={{
          background: "#fff",
          border: `1px solid ${colors.border}`,
          borderRadius: 10,
          padding: 20,
          display: "flex",
          flexDirection: "column",
          gap: 10,
          maxWidth: 360,
        }}
      >
        <label style={{ fontSize: 14, fontWeight: 600 }}>Admin password</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{ padding: "9px 12px", border: `1px solid ${colors.cardBorder}`, borderRadius: 8, fontSize: 14 }}
        />
        {loginError && <div style={{ color: colors.amber, fontSize: 13 }}>{loginError}</div>}
        <button
          type="submit"
          style={{
            background: colors.ink,
            color: "#fff",
            border: "none",
            borderRadius: 8,
            padding: "9px 16px",
            fontSize: 14,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Sign in
        </button>
      </form>
    );
  }

  return shell(
    <>
      <div
        style={{
          background: "#fff",
          border: `1px solid ${colors.border}`,
          borderRadius: 10,
          padding: 16,
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          fontSize: 13,
        }}
      >
        <div style={{ color: colors.muted }}>
          {rows.length} cases · scoring {scoring?.version} · weights text {scoring?.weights.textMatch} / rules{" "}
          {scoring?.weights.policy} / comprehension {scoring?.weights.comprehension} · review at{" "}
          {scoring?.threshold}+ or any maxed signal
          <br />
          About 3 Claude calls per case (~$1–2 for a full run, a few minutes).
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {errored.length > 0 && !running && (
            <button
              onClick={() => runAll(errored.map((r) => r.info.id))}
              style={{
                background: "#fff",
                color: colors.ink,
                border: `1px solid ${colors.cardBorder}`,
                borderRadius: 8,
                padding: "9px 14px",
                fontSize: 14,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Retry {errored.length} errored
            </button>
          )}
          <button
            onClick={() => runAll()}
            disabled={running}
            style={{
              background: colors.ink,
              color: "#fff",
              border: "none",
              borderRadius: 8,
              padding: "9px 16px",
              fontSize: 14,
              fontWeight: 600,
              cursor: running ? "default" : "pointer",
              opacity: running ? 0.6 : 1,
            }}
          >
            {running ? `Running… ${finished}/${rows.length}` : "Run test set"}
          </button>
        </div>
      </div>

      {done.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10 }}>
          {[
            { label: "Accuracy", value: judged.length ? `${Math.round((100 * correct) / judged.length)}%` : "—", sub: `${correct}/${judged.length} judged cases` },
            { label: "Unneeded reviews", value: String(fp.length), sub: fp.map((r) => r.info.id).join(", ") || "false positives" },
            { label: "Missed reviews", value: String(fn.length), sub: fn.map((r) => r.info.id).join(", ") || "false negatives" },
            { label: "Borderline / errors", value: `${done.length - judged.length} / ${errored.length}`, sub: "not scored" },
          ].map((t) => (
            <div key={t.label} style={{ background: "#fff", border: `1px solid ${colors.border}`, borderRadius: 10, padding: 14 }}>
              <div style={{ fontSize: 12, color: colors.muted }}>{t.label}</div>
              <div style={{ fontSize: 26, fontWeight: 700, marginTop: 2 }}>{t.value}</div>
              <div style={{ fontSize: 11, color: colors.muted, marginTop: 2 }}>{t.sub}</div>
            </div>
          ))}
        </div>
      )}

      <div style={{ background: "#fff", border: `1px solid ${colors.border}`, borderRadius: 10, overflow: "hidden" }}>
        {rows.map((r) => {
          const res = r.result;
          const mark =
            r.state === "running" ? "…" : r.state === "error" ? "!" : !res ? "" : res.correct === null ? "~" : res.correct ? "✓" : "✗";
          const markColor = res?.correct === false || r.state === "error" ? colors.amber : res?.correct ? colors.green : colors.muted;
          return (
            <div key={r.info.id} style={{ borderTop: `1px solid ${colors.border}` }}>
              <button
                onClick={() => setOpenId(openId === r.info.id ? null : r.info.id)}
                disabled={!res && r.state !== "error"}
                style={{
                  width: "100%",
                  background: "none",
                  border: "none",
                  padding: "9px 14px",
                  display: "grid",
                  gridTemplateColumns: "22px 64px 1fr 44px 150px",
                  gap: 8,
                  alignItems: "center",
                  textAlign: "left",
                  fontSize: 13,
                  color: colors.ink,
                  cursor: res || r.state === "error" ? "pointer" : "default",
                }}
              >
                <span style={{ fontWeight: 700, color: markColor }}>{mark}</span>
                <span style={{ color: colors.muted, fontFamily: "ui-monospace, monospace", fontSize: 12 }}>{r.info.id}</span>
                <span>{r.info.scenario}</span>
                <span style={{ fontWeight: 700, textAlign: "right" }}>{res ? res.card.score : ""}</span>
                <span style={{ fontSize: 12, color: colors.muted }}>
                  expect {r.info.expect.replace("_", " ")}
                  {res ? ` · got ${res.actual.replace("_", " ")}` : ""}
                </span>
              </button>
              {openId === r.info.id && (
                <div style={{ padding: "0 14px 12px 50px", fontSize: 12, display: "flex", flexDirection: "column", gap: 6 }}>
                  {r.error && <div style={{ color: colors.amber }}>Error: {r.error}</div>}
                  {res && (
                    <>
                      <div style={{ color: colors.muted }}>
                        {res.course} — {res.why}
                      </div>
                      {(["textMatch", "policy", "comprehension"] as const).map((k) => (
                        <div key={k}>
                          <strong>
                            {k === "textMatch" ? "AI text" : k === "policy" ? "Syllabus rules" : "Comprehension"}{" "}
                            {res.card.signals[k].points}/{res.card.signals[k].max}:
                          </strong>{" "}
                          {res.card.signals[k].reason || <span style={{ color: colors.muted }}>nothing notable</span>}
                        </div>
                      ))}
                      {res.quiz.quiz.map((q, i) => (
                        <div key={i} style={{ color: colors.muted }}>
                          Q: {q.question}
                          <br />
                          A: {res.answers[i]}
                        </div>
                      ))}
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
