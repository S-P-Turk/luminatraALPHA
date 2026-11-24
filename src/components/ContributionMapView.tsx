"use client";

import { useState } from "react";
import type { ContributionMap, ContributionKind } from "@/src/lib/contribution";
import type { RelianceResult, RelianceLevel, ParagraphResult } from "@/src/lib/reliance";

// The teacher's view of how a student relied on AI: a summary sentence, a
// reliance bar, and the submission paragraph by paragraph — each labeled with
// how much of its substance came from AI, with copied or paraphrased wording
// highlighted inside. Tapping a label or highlight shows the AI source.

type Cat = RelianceLevel | "disclosed";
const LEVEL: Record<Cat, { label: string; bar: string; tint: string; text: string }> = {
  written: { label: "Written by AI", bar: "#c0613f", tint: "#fbefe9", text: "#93391b" },
  heavy: { label: "Closely follows AI", bar: "#e0b25e", tint: "#fdf6e6", text: "#8a6216" },
  ideas: { label: "Built on AI ideas", bar: "#c9b7e0", tint: "#f6f2fb", text: "#5b4685" },
  disclosed: { label: "Disclosed AI help", bar: "#9fb5d6", tint: "#f1f5fb", text: "#3b5a8a" },
  none: { label: "Student's own", bar: "#e4e0d6", tint: "transparent", text: "var(--lum-muted)" },
};
const BAR_ORDER: Cat[] = ["written", "heavy", "ideas", "disclosed", "none"];
const MARK: Record<ContributionKind, { bg: string; line: string; label: string }> = {
  copied: { bg: "#f7d9cc", line: "#c0613f", label: "Copied from AI, not disclosed" },
  paraphrased: { bg: "#fbecc9", line: "#e0b25e", label: "Paraphrased from AI, not disclosed" },
  assisted: { bg: "#e3ebf7", line: "#9fb5d6", label: "AI-assisted (disclosed or polish only)" },
};
const KIND_WORD = { verbatim: "copied nearly word for word", paraphrased: "closely paraphrased", edited: "student's draft, polished by AI" };

const catOf = (p: ParagraphResult): Cat => (p.level !== "none" && p.disclosed ? "disclosed" : p.level);

type Selected = { type: "para"; i: number } | { type: "seg"; i: number } | null;

export function ContributionMapView({
  map,
  reliance,
  text,
}: {
  map: ContributionMap;
  reliance?: RelianceResult;
  text?: string;
}) {
  const [sel, setSel] = useState<Selected>(null);
  const [expanded, setExpanded] = useState(false);

  const paras = reliance?.paragraphs ?? [];
  const anyAi = paras.some((p) => p.level !== "none") || map.segments.length > 0;
  const shown = expanded ? paras : paras.slice(0, 6);

  function renderPara(p: ParagraphResult) {
    if (!text) return null;
    const pieces: React.ReactNode[] = [];
    let cursor = p.start;
    map.segments.forEach((seg, i) => {
      if (seg.end <= p.start || seg.start >= p.end) return;
      const s = Math.max(seg.start, p.start);
      const e = Math.min(seg.end, p.end);
      if (s > cursor) pieces.push(text.slice(cursor, s));
      const m = MARK[seg.kind];
      const on = sel?.type === "seg" && sel.i === i;
      pieces.push(
        <mark
          key={i}
          role="button"
          tabIndex={0}
          title={`${m.label} — tap to see the AI source`}
          onClick={() => setSel(on ? null : { type: "seg", i })}
          onKeyDown={(ev) => (ev.key === "Enter" || ev.key === " ") && (ev.preventDefault(), setSel(on ? null : { type: "seg", i }))}
          style={{
            background: m.bg,
            color: "inherit",
            borderBottom: `2px solid ${m.line}`,
            borderRadius: 3,
            padding: "0 1px",
            cursor: "pointer",
            outline: on ? `2px solid ${m.line}` : "none",
          }}
        >
          {text.slice(s, e)}
        </mark>
      );
      cursor = e;
    });
    if (cursor < p.end) pieces.push(text.slice(cursor, p.end));
    return pieces;
  }

  const selSeg = sel?.type === "seg" ? map.segments[sel.i] : null;
  const selSrc = selSeg ? map.sources[selSeg.source] : null;

  return (
    <div style={{ border: "1px solid var(--lum-border)", borderRadius: 8, padding: "10px 12px", display: "flex", flexDirection: "column", gap: 10 }}>
      <div>
        <div style={{ fontWeight: 700 }}>How AI was used</div>
        {map.summary && <div style={{ marginTop: 2 }}>{map.summary}</div>}
        {reliance?.legacy && (
          <div style={{ color: "var(--lum-muted)", fontSize: 12, marginTop: 4 }}>
            Analyzed before AI reliance existed — paragraphs are rated from copied text only, so AI ideas may be missed.
          </div>
        )}
      </div>

      {reliance && (
        <div>
          <div
            role="img"
            aria-label={BAR_ORDER.map((k) => `${LEVEL[k].label} ${reliance.percent[k]}%`).join(", ")}
            style={{ display: "flex", height: 10, borderRadius: 999, overflow: "hidden", background: LEVEL.none.bar }}
          >
            {BAR_ORDER.filter((k) => reliance.percent[k] > 0).map((k) => (
              <div key={k} style={{ width: `${reliance.percent[k]}%`, background: LEVEL[k].bar }} />
            ))}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 14px", marginTop: 6, fontSize: 12 }}>
            {BAR_ORDER.filter((k) => k === "none" || reliance.percent[k] > 0).map((k) => (
              <span key={k} style={{ display: "inline-flex", alignItems: "center", gap: 5, color: LEVEL[k].text }}>
                <span style={{ width: 9, height: 9, borderRadius: 2, background: LEVEL[k].bar, display: "inline-block" }} />
                {LEVEL[k].label} · <strong>{reliance.percent[k]}%</strong>
              </span>
            ))}
          </div>
          <div style={{ fontSize: 12, color: "var(--lum-muted)", marginTop: 4 }}>
            Undisclosed AI reliance: <strong style={{ color: "var(--lum-ink)" }}>{Math.round(reliance.reliance * 100)}%</strong>
            {reliance.disclosedReliance > 0 && <> · disclosed: {Math.round(reliance.disclosedReliance * 100)}%</>}
            {" "}— weighted by how much each paragraph depends on AI.
          </div>
        </div>
      )}

      {text && paras.length > 0 && (
        <div>
          <div style={{ fontSize: 12, color: "var(--lum-muted)", marginBottom: 4 }}>
            {anyAi ? "Submission by paragraph — tap a label or highlight to see the AI source." : "Submission"}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {shown.map((p, i) => {
              const c = catOf(p);
              const st = LEVEL[c];
              const on = sel?.type === "para" && sel.i === i;
              return (
                <div
                  key={p.index}
                  style={{
                    borderLeft: `3px solid ${st.bar}`,
                    background: st.tint,
                    borderRadius: "0 6px 6px 0",
                    padding: "6px 10px",
                  }}
                >
                  <button
                    onClick={() => setSel(on ? null : { type: "para", i })}
                    disabled={p.level === "none"}
                    style={{
                      background: "none",
                      border: "none",
                      padding: 0,
                      fontSize: 11,
                      fontWeight: 700,
                      letterSpacing: "0.03em",
                      textTransform: "uppercase",
                      color: st.text,
                      cursor: p.level === "none" ? "default" : "pointer",
                      opacity: 1,
                    }}
                  >
                    ¶{p.index} · {st.label}
                    {p.level !== "none" ? (on ? " ▴" : " ▾") : ""}
                  </button>
                  <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.6, marginTop: 2 }}>{renderPara(p)}</div>
                  {on && (
                    <div style={{ marginTop: 6, fontSize: 12 }}>
                      {p.note && <div>{p.note}</div>}
                      {p.source ? (
                        <>
                          <div style={{ color: "var(--lum-muted)", marginTop: 4 }}>From the AI&apos;s reply in the transcript:</div>
                          <blockquote style={{ margin: "2px 0 0", paddingLeft: 10, borderLeft: "3px solid #c9d3e4", fontStyle: "italic" }}>
                            {p.source}
                          </blockquote>
                        </>
                      ) : (
                        <div style={{ color: "var(--lum-muted)", marginTop: 4 }}>
                          Based on AI-written text found in this paragraph (highlighted).
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {paras.length > 6 && (
            <button
              onClick={() => setExpanded((v) => !v)}
              style={{ background: "none", border: "none", padding: "6px 0 0", color: "var(--lum-accent)", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
            >
              {expanded ? "Show fewer paragraphs" : `Show all ${paras.length} paragraphs`}
            </button>
          )}
        </div>
      )}

      {selSeg && selSrc && (
        <div style={{ background: "#f4f6fa", border: "1px solid #dde3ee", borderRadius: 6, padding: "10px 12px", fontSize: 12 }}>
          <div style={{ fontWeight: 700, color: MARK[selSeg.kind].line }}>
            {MARK[selSeg.kind].label} · {KIND_WORD[selSrc.kind]}
          </div>
          <div style={{ color: "var(--lum-muted)", marginTop: 6 }}>From the AI&apos;s reply in the transcript:</div>
          <blockquote style={{ margin: "4px 0 0", paddingLeft: 10, borderLeft: "3px solid #c9d3e4", fontStyle: "italic" }}>
            {selSrc.transcriptExcerpt ?? "(source text not recorded for this older analysis)"}
          </blockquote>
        </div>
      )}

      {!map.speakersDetected && anyAi && (
        <div style={{ fontSize: 11, color: "var(--lum-muted)" }}>
          The transcript doesn&apos;t label who said what, so sources were matched against the whole conversation.
        </div>
      )}
    </div>
  );
}
