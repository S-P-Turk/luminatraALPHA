"use client";

import { useEffect, useState } from "react";
import { K, Cell, Big, Sub, Btn, LinkBtn, Header, Grid, th, td, tdMono, Loading, usd } from "../ui";
import { toast } from "@/src/components/Toaster";

type Spending = {
  month: string;
  today: number;
  week: number;
  total: number;
  projected: number;
  perSubmission: number | null;
  settings: { monthlyBudget: number; alertAt: number; hardStop: boolean };
  byStep: { step: string; cost: number; calls: number }[];
  daily: { day: string; cost: number; future: boolean }[];
  byClass: { name: string; teacher: string; submissions: number; cost: number }[];
  calls: number;
  prices: { input: number; output: number };
};

const STEP_LABEL: Record<string, string> = {
  analysis: "submission analysis",
  grading: "quiz grading",
  lab: "test lab",
  eval: "test-set runs",
  suggestions: "assignment suggestions",
};
const STEP_COLOR: Record<string, string> = {
  analysis: K.sig,
  grading: "#9DB4DD",
  lab: K.clay,
  eval: "#B9A6E0",
  suggestions: K.mute,
};

export default function SpendingClient() {
  const [data, setData] = useState<Spending | null>(null);
  const [editing, setEditing] = useState(false);
  const [budgetInput, setBudgetInput] = useState("");
  const [alertInput, setAlertInput] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    const res = await fetch("/api/admin/spending");
    if (res.ok) setData(await res.json());
  }
  useEffect(() => {
    void load();
  }, []);

  async function patch(body: Record<string, unknown>, done: string) {
    setSaving(true);
    const res = await fetch("/api/admin/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const d = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) return toast(d.error ?? "Couldn't save.", "error");
    setData((prev) => (prev ? { ...prev, settings: d.settings } : prev));
    toast(done);
  }

  async function saveBudget(e: React.FormEvent) {
    e.preventDefault();
    await patch({ monthlyBudget: Number(budgetInput), alertAt: Number(alertInput) / 100 }, "Budget updated.");
    setEditing(false);
  }

  if (!data) {
    return (
      <>
        <Header sheet="luminatra / admin / api spending" title="API spending" />
        <Loading />
      </>
    );
  }

  const b = data.settings.monthlyBudget;
  const spentPct = b ? Math.min(1, data.total / b) : 0;
  const projPct = b ? Math.min(1, data.projected / b) : 0;
  const maxDay = Math.max(0.01, ...data.daily.map((d) => d.cost));
  const stepTotal = data.byStep.reduce((s, x) => s + x.cost, 0);
  const blocks = 40;

  return (
    <>
      <Header sheet={`luminatra / admin / api spending · ${data.month}`} title="API spending">
        <Btn onClick={() => { setData(null); void load(); }}>refresh</Btn>
        <LinkBtn href="/api/admin/spending/csv">Calls CSV</LinkBtn>
      </Header>

      <Grid min={220}>
        <Cell label="today" refId="A1"><Big>{usd(data.today)}</Big><Sub>since midnight UTC</Sub></Cell>
        <Cell label="last 7 days" refId="A2"><Big>{usd(data.week)}</Big><Sub>{data.calls} calls this month</Sub></Cell>
        <Cell label="this month" refId="A3"><Big>{usd(data.total)}</Big><Sub>of {usd(b)} budget</Sub></Cell>
        <Cell label="per submission" refId="A4">
          <Big color={K.sig}>{data.perSubmission == null ? "—" : usd(data.perSubmission, 3)}</Big>
          <Sub>analysis + grading ÷ submissions</Sub>
        </Cell>
      </Grid>

      <Cell label="monthly budget" refId="B1">
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
          <div style={{ fontFamily: K.mono, fontSize: 28 }}>
            {usd(data.total)} <span style={{ color: K.mute, fontSize: 16 }}>/ {usd(b)}</span>
          </div>
          <div style={{ fontFamily: K.mono, fontSize: 12, color: K.mute }}>on pace for {usd(data.projected)} by month end</div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${blocks}, minmax(0, 1fr))`, gap: 3, marginTop: 14 }} role="img" aria-label={`${Math.round(spentPct * 100)} percent of budget spent, ${Math.round(projPct * 100)} percent projected, alert at ${Math.round(data.settings.alertAt * 100)} percent`}>
          {Array.from({ length: blocks }, (_, i) => {
            // A block fills once spend reaches into it, so any spend shows.
            const from = i / blocks;
            const isAlert = Math.abs((i + 0.5) / blocks - data.settings.alertAt) < 0.5 / blocks;
            return (
              <span key={i} style={{ height: 18, background: from < spentPct ? K.sig : from < projPct ? K.sigDim : "#2A2A28", outline: isAlert ? `1px solid ${K.clay}` : "none" }} />
            );
          })}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontFamily: K.mono, fontSize: 11, color: K.mute, marginTop: 8 }}>
          <span>{Math.round(spentPct * 100)}% used · {Math.round(projPct * 100)}% projected</span>
          <span style={{ color: K.clay }}>alert ▸ {Math.round(data.settings.alertAt * 100)}%</span>
          <span>{data.settings.hardStop ? "stop" : "no stop"} ▸ 100%</span>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 18, marginTop: 16, paddingTop: 14, borderTop: `1px solid ${K.line}` }}>
          <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14 }}>
            <input
              type="checkbox"
              checked={data.settings.hardStop}
              disabled={saving}
              onChange={(e) => patch({ hardStop: e.target.checked }, e.target.checked ? "New analyses will pause at 100% of budget." : "Hard stop off: analyses continue past the budget.")}
              style={{ width: 18, height: 18, accentColor: K.sig }}
            />
            Pause new analyses at 100%
          </label>
          <span style={{ fontSize: 13, color: K.mute }}>The overview shows a warning once spend passes the alert line.</span>
          <span style={{ marginLeft: "auto" }}>
            <Btn onClick={() => { setBudgetInput(String(b)); setAlertInput(String(Math.round(data.settings.alertAt * 100))); setEditing((v) => !v); }}>
              {editing ? "cancel" : "edit budget"}
            </Btn>
          </span>
        </div>
        {editing && (
          <form onSubmit={saveBudget} style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", gap: 12, marginTop: 14 }}>
            <label style={{ display: "flex", flexDirection: "column", gap: 6, fontFamily: K.mono, fontSize: 11, color: K.mute }}>
              monthly budget ($)
              <input type="number" min="0" step="1" required value={budgetInput} onChange={(e) => setBudgetInput(e.target.value)} style={{ width: 140, background: K.bg, color: K.fg, border: `1px solid ${K.line}`, borderRadius: 6, padding: "9px 10px", fontFamily: K.mono, fontSize: 14 }} />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 6, fontFamily: K.mono, fontSize: 11, color: K.mute }}>
              alert at (%)
              <input type="number" min="1" max="100" step="1" required value={alertInput} onChange={(e) => setAlertInput(e.target.value)} style={{ width: 110, background: K.bg, color: K.fg, border: `1px solid ${K.line}`, borderRadius: 6, padding: "9px 10px", fontFamily: K.mono, fontSize: 14 }} />
            </label>
            <Btn type="submit" primary disabled={saving}>{saving ? "saving…" : "save"}</Btn>
          </form>
        )}
      </Cell>

      <Grid min={420}>
        <Cell label="where it went" refId="C1">
          {stepTotal === 0 ? (
            <div style={{ fontFamily: K.mono, fontSize: 13, color: K.mute }}>no spend yet this month</div>
          ) : (
            <>
              <div style={{ display: "flex", height: 8 }} role="img" aria-label={data.byStep.filter((s) => s.cost > 0).map((s) => `${STEP_LABEL[s.step]} ${Math.round((s.cost / stepTotal) * 100)} percent`).join(", ")}>
                {data.byStep.filter((s) => s.cost > 0).map((s) => (
                  <div key={s.step} style={{ width: `${(s.cost / stepTotal) * 100}%`, background: STEP_COLOR[s.step] }} />
                ))}
              </div>
              <div style={{ marginTop: 12 }}>
                {data.byStep.map((s, i) => (
                  <div key={s.step} style={{ display: "grid", gridTemplateColumns: "12px minmax(0, 1fr) 70px 52px 72px", gap: 10, alignItems: "center", padding: "9px 0", borderTop: i ? `1px solid ${K.line}` : "none", fontSize: 13 }}>
                    <span style={{ width: 10, height: 10, background: STEP_COLOR[s.step] }} />
                    <span>{STEP_LABEL[s.step]}</span>
                    <span style={{ fontFamily: K.mono, fontSize: 12, color: K.mute, textAlign: "right" }}>{s.calls} {s.calls === 1 ? "call" : "calls"}</span>
                    <span style={{ fontFamily: K.mono, fontSize: 12, color: K.mute, textAlign: "right" }}>{stepTotal ? Math.round((s.cost / stepTotal) * 100) : 0}%</span>
                    <span style={{ fontFamily: K.mono, fontSize: 13, textAlign: "right" }}>{usd(s.cost)}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </Cell>
        <Cell label="daily spend" refId="C2">
          <svg viewBox="0 0 520 200" width="100%" height="200" role="img" aria-label={`Daily spend this month, highest day ${usd(maxDay)}`} style={{ display: "block" }}>
            <line x1="40" x2="520" y1="170" y2="170" stroke={K.line} />
            <line x1="40" x2="520" y1="20" y2="20" stroke={K.grid} />
            <text x="34" y="24" textAnchor="end" fontFamily="monospace" fontSize="11" fill={K.mute}>{usd(maxDay)}</text>
            <text x="34" y="174" textAnchor="end" fontFamily="monospace" fontSize="11" fill={K.mute}>$0</text>
            {data.daily.map((d, i) => {
              const w = 480 / data.daily.length;
              const h = (d.cost / maxDay) * 150;
              return (
                <rect key={d.day} x={42 + i * w} y={170 - h} width={Math.max(2, w - 3)} height={Math.max(d.future ? 0 : 1, h)} fill={d.future ? "transparent" : K.sig}>
                  <title>{`${d.day}: ${usd(d.cost, 3)}`}</title>
                </rect>
              );
            })}
            <text x="42" y="190" fontFamily="monospace" fontSize="11" fill={K.mute}>{data.daily[0]?.day.slice(5)}</text>
            <text x="520" y="190" textAnchor="end" fontFamily="monospace" fontSize="11" fill={K.mute}>{data.daily[data.daily.length - 1]?.day.slice(5)}</text>
          </svg>
        </Cell>
      </Grid>

      <Cell label="by class" refId="D1">
        {data.byClass.length === 0 ? (
          <div style={{ fontFamily: K.mono, fontSize: 13, color: K.mute }}>nothing yet this month</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", minWidth: 620, borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th scope="col" style={th}>class</th>
                  <th scope="col" style={th}>teacher</th>
                  <th scope="col" style={{ ...th, textAlign: "right" }}>submissions / runs</th>
                  <th scope="col" style={{ ...th, textAlign: "right" }}>per item</th>
                  <th scope="col" style={{ ...th, textAlign: "right" }}>this month</th>
                </tr>
              </thead>
              <tbody>
                {data.byClass.map((c) => (
                  <tr key={c.name}>
                    <td style={td}>{c.name}</td>
                    <td style={{ ...tdMono, color: K.mute }}>{c.teacher}</td>
                    <td style={{ ...tdMono, textAlign: "right" }}>{c.submissions}</td>
                    <td style={{ ...tdMono, textAlign: "right", color: K.mute }}>{c.submissions ? usd(c.cost / c.submissions, 3) : "—"}</td>
                    <td style={{ ...tdMono, textAlign: "right" }}>{usd(c.cost)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Cell>

      <p style={{ margin: 0, fontFamily: K.mono, fontSize: 11, color: K.mute }}>
        Costs are estimated from token counts at ${data.prices.input}/M input and ${data.prices.output}/M output tokens. Tracking started with this version; earlier calls aren&apos;t included.
      </p>
    </>
  );
}
