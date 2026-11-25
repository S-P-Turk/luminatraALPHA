"use client";

import { useEffect, useState } from "react";
import { K, Cell, Big, Sub, Btn, LinkBtn, Header, Grid, th, td, tdMono, Loading, Bar, usd, timeAgo } from "../ui";

type Run = {
  id: number;
  version: string;
  at: string;
  total: number;
  judged: number;
  correct: number;
  relianceJudged: number;
  relianceCorrect: number;
  costUsd: number;
};
type Quality = {
  version: string;
  weights: { comprehension: number; reliance: number; policy: number };
  threshold: number;
  latest: (Run & { errors: number; borderline: number; createdAt: string }) | null;
  confirmed: boolean;
  runs: Run[];
  agreement: { followed: number; total: number } | null;
  bins: { from: number; count: number }[];
  scored: number;
  cleared: { score: number | null; reason: string; className: string; student: string; at: string }[];
};

// Runs from before results were saved here (Nov 23–24), so the history
// shows the whole story.
const EARLIER = [
  { label: "v1", date: "Nov 23", decisions: 93, reliance: null as number | null, note: "copy-only text match · 26/28" },
  { label: "v3", date: "Nov 24", decisions: 100, reliance: 83, note: "AI reliance added · 31/31 · 24/29" },
];

const pctOf = (a: number, b: number) => (b ? Math.round((a / b) * 100) : null);

export default function QualityClient() {
  const [data, setData] = useState<Quality | null>(null);

  async function load() {
    const res = await fetch("/api/admin/quality");
    if (res.ok) setData(await res.json());
  }
  useEffect(() => {
    void load();
  }, []);

  if (!data) {
    return (
      <>
        <Header sheet="sheet 04 / quality" title="Model quality" />
        <Loading />
      </>
    );
  }

  const l = data.latest;
  const history = [
    ...EARLIER,
    ...data.runs.map((r) => ({
      label: r.version,
      date: new Date(r.at).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      decisions: pctOf(r.correct, r.judged),
      reliance: pctOf(r.relianceCorrect, r.relianceJudged),
      note: `${r.correct}/${r.judged} · ${r.relianceCorrect}/${r.relianceJudged} · ${usd(r.costUsd)}`,
    })),
  ].slice(-6);
  const maxBin = Math.max(1, ...data.bins.map((b) => b.count));

  return (
    <>
      <Header sheet={`sheet 04 / quality — scoring ${data.version}`} title="Model quality">
        <Btn onClick={() => { setData(null); void load(); }}>refresh</Btn>
        <LinkBtn href="/admin/lab#test-set" primary>run test set</LinkBtn>
      </Header>

      <Grid min={220}>
        <Cell label="test set: correct review decisions" refId="A1">
          <Big color={l && l.correct === l.judged ? K.sage : undefined}>{l ? `${l.correct}/${l.judged}` : "—"}</Big>
          <Sub>{l ? `last run · ${l.version} · ${timeAgo(l.createdAt)}` : "no saved runs yet"}</Sub>
        </Cell>
        <Cell label="test set: correct AI-reliance labels" refId="A2">
          <Big color={l && l.relianceCorrect === l.relianceJudged ? K.sage : undefined}>{l ? `${l.relianceCorrect}/${l.relianceJudged}` : "—"}</Big>
          <Sub>{l ? `${l.errors} errors · ${l.borderline} borderline` : "run the test set"}</Sub>
        </Cell>
        <Cell label="teachers agreed with the flag" refId="A3">
          <Big>{data.agreement ? `${pctOf(data.agreement.followed, data.agreement.total)}%` : "—"}</Big>
          <Sub>{data.agreement ? `${data.agreement.followed} of ${data.agreement.total} flags followed up` : "appears after teachers review flags"}</Sub>
        </Cell>
        <Cell label="live scoring version" refId="A4">
          <Big color={data.confirmed ? K.sage : K.sig}>{data.version}</Big>
          <Sub color={data.confirmed ? K.sage : K.sig}>{data.confirmed ? "confirmed by a test-set run" : "unconfirmed · run the test set"}</Sub>
        </Cell>
      </Grid>

      <Cell label="test-set runs over time" refId="B1">
        <div style={{ display: "flex", gap: 18, fontFamily: K.mono, fontSize: 11, color: K.mute, marginBottom: 14 }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><span style={{ width: 10, height: 10, background: K.fg }} />decisions</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><span style={{ width: 10, height: 10, background: K.sig }} />reliance labels</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: `repeat(auto-fit, minmax(min(150px, 100%), 1fr))`, gap: 20 }} role="img" aria-label={history.map((h) => `${h.label} ${h.date}: decisions ${h.decisions ?? "n/a"} percent, reliance ${h.reliance ?? "n/a"} percent`).join("; ")}>
          {history.map((h, i) => (
            <div key={i} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "flex-end", height: 150, borderBottom: `1px solid ${K.line}`, padding: "0 8px" }}>
                {[
                  [h.decisions, K.fg],
                  [h.reliance, K.sig],
                ].map(([v, c], j) => (
                  <div key={j} style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "flex-end", height: "100%" }}>
                    <span style={{ fontFamily: K.mono, fontSize: 12, textAlign: "center", color: v == null ? K.mute : K.fg, paddingBottom: 4 }}>{v == null ? "n/a" : `${v}%`}</span>
                    <div style={{ height: `${(v as number | null) ?? 0}%`, background: c as string, minHeight: v == null ? 1 : 0 }} />
                  </div>
                ))}
              </div>
              <div style={{ fontFamily: K.mono, fontSize: 13 }}>{h.label} <span style={{ color: K.mute }}>· {h.date}</span></div>
              <div style={{ fontFamily: K.mono, fontSize: 11, color: K.mute }}>{h.note}</div>
            </div>
          ))}
        </div>
      </Cell>

      <Grid min={420}>
        <Cell label="follow-up priority across real submissions" refId="C1">
          {data.scored === 0 ? (
            <div style={{ fontFamily: K.mono, fontSize: 13, color: K.mute }}>no scored submissions yet</div>
          ) : (
            <svg viewBox="0 0 520 190" width="100%" height="150" role="img" aria-label={`Follow-up priority across ${data.scored} submissions; review line at ${data.threshold}`} style={{ display: "block" }}>
              <line x1="10" x2="520" y1="160" y2="160" stroke={K.line} />
              {data.bins.map((b, i) => {
                const h = (b.count / maxBin) * 130;
                return (
                  <rect key={i} x={14 + i * 50} y={160 - h} width="40" height={h} fill={b.from >= data.threshold ? K.sig : K.mute}>
                    <title>{`${b.from}–${b.from + 9}: ${b.count}`}</title>
                  </rect>
                );
              })}
              <line x1={9 + (data.threshold / 10) * 50} x2={9 + (data.threshold / 10) * 50} y1="14" y2="160" stroke={K.fg} strokeDasharray="3 4" />
              <text x={15 + (data.threshold / 10) * 50} y="24" fontFamily="monospace" fontSize="11" fill={K.fg}>review ≥ {data.threshold}</text>
              <text x="14" y="180" fontFamily="monospace" fontSize="11" fill={K.mute}>0</text>
              <text x="510" y="180" textAnchor="end" fontFamily="monospace" fontSize="11" fill={K.mute}>100</text>
            </svg>
          )}
          <Sub>{data.scored} scored submissions</Sub>
        </Cell>
        <Cell label="score formula" refId="C2">
          <p style={{ margin: "0 0 10px", fontSize: 13, color: K.mute, lineHeight: 1.5 }}>Claude proposes evidence. Luminatra&apos;s own rules decide what counts.</p>
          {([
            ["comprehension", data.weights.comprehension, K.fg],
            ["ai reliance", data.weights.reliance, K.sig],
            ["syllabus rules", data.weights.policy, "#9DB4DD"],
          ] as const).map(([n, w, c], i) => (
            <div key={n} style={{ padding: "10px 0", borderTop: i ? `1px solid ${K.line}` : "none" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontFamily: K.mono, fontSize: 13 }}><span>{n}</span><span>{w}</span></div>
              <div style={{ marginTop: 6 }}><Bar value={w} max={100} color={c} /></div>
            </div>
          ))}
          <p style={{ margin: "10px 0 0", paddingTop: 10, borderTop: `1px solid ${K.line}`, fontSize: 13, color: K.mute, lineHeight: 1.6 }}>
            Review at <span style={{ fontFamily: K.mono, color: K.fg }}>{data.threshold}+</span>, or when any one signal is maxed. &ldquo;Closely follows AI&rdquo; needs <span style={{ fontFamily: K.mono, color: K.fg }}>55%</span> of key words from the AI source; &ldquo;written by AI&rdquo; needs <span style={{ fontFamily: K.mono, color: K.fg }}>75%</span> of phrases.
          </p>
        </Cell>
      </Grid>

      <Cell label="flags teachers cleared · possible false alarms" refId="D1">
        {data.cleared.length === 0 ? (
          <div style={{ fontFamily: K.mono, fontSize: 13, color: K.mute }}>none yet — cleared flags appear here to study before changing weights</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", minWidth: 680, borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th scope="col" style={th}>score</th>
                  <th scope="col" style={th}>main reason</th>
                  <th scope="col" style={th}>student</th>
                  <th scope="col" style={th}>class</th>
                  <th scope="col" style={th}>cleared</th>
                </tr>
              </thead>
              <tbody>
                {data.cleared.map((c, i) => (
                  <tr key={i}>
                    <td style={{ ...tdMono, color: K.sig }}>{c.score ?? "—"}</td>
                    <td style={{ ...td, color: K.mute }}>{c.reason}</td>
                    <td style={td}>{c.student}</td>
                    <td style={tdMono}>{c.className}</td>
                    <td style={{ ...tdMono, color: K.mute }}>{timeAgo(c.at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Cell>
    </>
  );
}
