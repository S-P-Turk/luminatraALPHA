"use client";

import { useEffect, useState } from "react";
import { K, Cell, Btn, LinkBtn, Header, Grid, th, td, tdMono, Loading, timeAgo, usd } from "./ui";
import { toast } from "@/src/components/Toaster";

type Overview = {
  stats: {
    teachers: number;
    students: number;
    classes: number;
    openAssignments: number;
    submissions: number;
    submissionsThisMonth: number;
    submissionsLastMonth: number;
    awaitingReview: number;
    oldestFlaggedDays: number | null;
  };
  days: { day: string; submitted: number; review: number }[];
  attention: { kind: "warn" | "todo" | "info"; title: string; text: string; href?: string; link?: string }[];
  health: {
    aiStatus: string;
    errorRate24h: number;
    calls24h: number;
    avgAnalysisMs: number | null;
    scoringVersion: string;
    confirmed: boolean;
    deploy: string;
    deployMessage: string;
  };
  activity: { at: string; who: string; what: string; where: string }[];
  budget: { spent: number; budget: number };
};

export default function OverviewClient() {
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resetEmail, setResetEmail] = useState("");
  const [resetting, setResetting] = useState(false);

  async function load() {
    const res = await fetch("/api/admin/overview");
    if (!res.ok) return setError("Couldn't load the overview.");
    setData(await res.json());
  }

  useEffect(() => {
    void load();
  }, []);

  async function resetPassword(e: React.FormEvent) {
    e.preventDefault();
    setResetting(true);
    const res = await fetch("/api/admin/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: resetEmail }),
    });
    const d = await res.json().catch(() => ({}));
    setResetting(false);
    if (!res.ok) return toast(d.error ?? "Couldn't reset that account.", "error");
    toast(`${resetEmail}: ${(d.done as string[]).join("; ")}.`);
    setResetEmail("");
  }

  const s = data?.stats;
  const change = s && s.submissionsLastMonth ? (s.submissionsThisMonth - s.submissionsLastMonth) / s.submissionsLastMonth : null;
  const maxDay = Math.max(1, ...(data?.days.map((d) => d.submitted) ?? [1]));

  return (
    <>
      <Header sheet="sheet 01 / overview" title="Overview">
        <Btn onClick={() => { setData(null); void load(); }}>refresh</Btn>
        <LinkBtn href="/api/admin/report">Export CSV</LinkBtn>
      </Header>

      {error && <div style={{ fontFamily: K.mono, fontSize: 13, color: K.clay }}>{error}</div>}
      {!data && !error && <Loading />}

      {data && s && (
        <>
          <Grid min={360}>
            <Cell label={`flagged submissions waiting on a teacher · ${s.awaitingReview}`} refId="A1">
              {s.awaitingReview > 0 && (
                <div style={{ fontFamily: K.mono, fontSize: 12, color: s.oldestFlaggedDays && s.oldestFlaggedDays >= 2 ? K.clay : K.mute, marginBottom: 6 }}>
                  oldest has waited {s.oldestFlaggedDays} d
                </div>
              )}
              {data.attention.length === 0 ? (
                <div style={{ fontFamily: K.mono, fontSize: 12, color: K.sage }}>nothing for you to do</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column" }}>
                  {data.attention.map((a, i) => (
                    <div key={i} style={{ display: "grid", gridTemplateColumns: "44px minmax(0, 1fr)", gap: 8, padding: "6px 0", borderTop: i ? `1px solid ${K.line}` : "none" }}>
                      <span style={{ fontFamily: K.mono, fontSize: 11, color: a.kind === "warn" ? K.clay : a.kind === "todo" ? K.sig : K.mute }}>{a.kind}</span>
                      <span style={{ fontSize: 13, lineHeight: 1.45, color: K.mute }}>
                        <span style={{ color: K.fg }}>{a.title}</span> {a.text}{" "}
                        {a.href && <a href={a.href} style={{ color: K.sig, fontFamily: K.mono, fontSize: 12 }}>{a.link} ▸</a>}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </Cell>
            <Cell label="analysis pipeline" refId="A2">
              {[
                ["Claude API", data.health.aiStatus, data.health.aiStatus === "operational" ? K.sage : data.health.aiStatus === "no calls yet" ? K.mute : K.clay],
                ["failed calls, 24h", `${Math.round(data.health.errorRate24h * 100)}% of ${data.health.calls24h}`, data.health.errorRate24h > 0.05 ? K.clay : K.fg],
                ["time per analysis", data.health.avgAnalysisMs ? `${(data.health.avgAnalysisMs / 1000).toFixed(1)} s avg` : "—", K.fg],
                ["scoring version", `${data.health.scoringVersion} · ${data.health.confirmed ? "test set passed" : "not re-tested"}`, data.health.confirmed ? K.sage : K.sig],
                ["live commit", data.health.deploy, K.fg],
                ["API spend this month", `${usd(data.budget.spent)} of ${usd(data.budget.budget)}`, K.fg],
              ].map(([k, v, c], i) => (
                <div key={k} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "5px 0", borderTop: i ? `1px solid ${K.line}` : "none", fontSize: 12 }}>
                  <span style={{ fontFamily: K.mono, color: K.mute }}>{k}</span>
                  <span style={{ fontFamily: K.mono, color: c }}>{v}</span>
                </div>
              ))}
            </Cell>
          </Grid>

          <Cell label="usage" refId="B1">
            <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 20px", fontFamily: K.mono, fontSize: 12, color: K.mute, marginBottom: 8 }}>
              <span><span style={{ color: K.fg }}>{s.teachers}</span> teachers</span>
              <span><span style={{ color: K.fg }}>{s.classes}</span> classes</span>
              <span><span style={{ color: K.fg }}>{s.openAssignments}</span> open assignments</span>
              <span><span style={{ color: K.fg }}>{s.students}</span> students</span>
              <span><span style={{ color: K.fg }}>{s.submissions}</span> submissions total, {s.submissionsThisMonth} this month{change != null ? ` (${change >= 0 ? "+" : ""}${Math.round(change * 100)}% vs last month)` : ""}</span>
            </div>
            <div style={{ display: "flex", gap: 14, fontFamily: K.mono, fontSize: 11, color: K.mute, marginBottom: 4 }}>
              <span>submissions per day, last 30 days:</span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><span style={{ width: 8, height: 8, background: K.mute }} />submitted</span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><span style={{ width: 8, height: 8, background: K.sig }} />flagged for review</span>
            </div>
            <svg viewBox="0 0 1000 120" width="100%" height="110" role="img" aria-label={`Submissions per day for 30 days; ${s.submissionsThisMonth} this month`} style={{ display: "block" }}>
              <line x1="30" x2="1000" y1="100" y2="100" stroke={K.line} />
              <text x="24" y="14" textAnchor="end" fontFamily="monospace" fontSize="11" fill={K.mute}>{maxDay}</text>
              <text x="24" y="104" textAnchor="end" fontFamily="monospace" fontSize="11" fill={K.mute}>0</text>
              {data.days.map((d, i) => {
                const x = 40 + i * 32;
                const h = (d.submitted / maxDay) * 90;
                const r = (d.review / maxDay) * 90;
                return (
                  <g key={d.day}>
                    <rect x={x} y={100 - h} width="16" height={h} fill={K.mute}><title>{`${d.day}: ${d.submitted} submitted, ${d.review} flagged`}</title></rect>
                    {r > 0 && <rect x={x} y={100 - r} width="16" height={r} fill={K.sig} />}
                  </g>
                );
              })}
              <text x="40" y="117" fontFamily="monospace" fontSize="11" fill={K.mute}>{data.days[0]?.day}</text>
              <text x="1000" y="117" textAnchor="end" fontFamily="monospace" fontSize="11" fill={K.mute}>today</text>
            </svg>
          </Cell>

          <Grid min={420}>
            <Cell label="latest teacher and student actions" refId="C1">
              {data.activity.length === 0 ? (
                <div style={{ fontFamily: K.mono, fontSize: 13, color: K.mute }}>no activity yet</div>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", minWidth: 460, borderCollapse: "collapse" }}>
                    <thead>
                      <tr><th scope="col" style={th}>when</th><th scope="col" style={th}>who</th><th scope="col" style={th}>what</th><th scope="col" style={th}>class</th></tr>
                    </thead>
                    <tbody>
                      {data.activity.map((a, i) => (
                        <tr key={i}>
                          <td style={{ ...tdMono, color: K.mute, whiteSpace: "nowrap" }}>{timeAgo(a.at)}</td>
                          <td style={td}>{a.who}</td>
                          <td style={{ ...td, color: K.mute }}>{a.what}</td>
                          <td style={tdMono}>{a.where}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Cell>
            <Cell label="reset an account password" refId="C2">
              <form onSubmit={resetPassword} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <label htmlFor="reset-email" style={{ fontSize: 12, color: K.mute, lineHeight: 1.45 }}>
                  Any teacher or student. They create a new password at their next sign-in. An accidental empty teacher
                  account on a student&apos;s email is removed.
                </label>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <input
                    id="reset-email"
                    type="email"
                    required
                    placeholder="email@school.edu"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    style={{ flex: "1 1 220px", background: K.bg, color: K.fg, border: `1px solid ${K.line}`, borderRadius: 0, padding: "5px 8px", fontFamily: K.mono, fontSize: 12 }}
                  />
                  <Btn type="submit" disabled={resetting || !resetEmail}>{resetting ? "resetting…" : "reset"}</Btn>
                </div>
              </form>
            </Cell>
          </Grid>
        </>
      )}
    </>
  );
}
