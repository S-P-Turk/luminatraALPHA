"use client";

import { useState } from "react";
import type { ContributionMap, ContributionKind } from "@/src/lib/contribution";

// The teacher's view of how a student used AI in a submission: a summary
// sentence, a breakdown bar, and the submission text with AI-derived
// passages highlighted. Tapping a highlight shows the AI reply it came from.

const STYLE: Record<ContributionKind | "student", { label: string; bar: string; mark: string; text: string }> = {
  student: { label: "Student's own writing", bar: "#e4e0d6", mark: "transparent", text: "var(--lum-muted)" },
  assisted: { label: "AI-assisted, disclosed or polish only", bar: "#9fb5d6", mark: "#e3ebf7", text: "#3b5a8a" },
  paraphrased: { label: "Paraphrased from AI, not disclosed", bar: "#e0b25e", mark: "#fbecc9", text: "#8a6216" },
  copied: { label: "Copied from AI, not disclosed", bar: "#c0613f", mark: "#f7d9cc", text: "#93391b" },
};
const ORDER: (ContributionKind | "student")[] = ["copied", "paraphrased", "assisted", "student"];
const KIND_WORD = { verbatim: "copied nearly word for word", paraphrased: "closely paraphrased", edited: "student's own draft, polished by AI" };

const PREVIEW_CHARS = 900;

export function ContributionMapView({ map, text }: { map: ContributionMap; text?: string }) {
  const [active, setActive] = useState<number | null>(null);
  const [expanded, setExpanded] = useState(false);

  const hasAi = map.words.copied + map.words.paraphrased + map.words.assisted > 0;
  const activeSeg = active !== null ? map.segments[active] : null;
  const activeSrc = activeSeg ? map.sources[activeSeg.source] : null;

  // Build the highlighted text, optionally truncated.
  const limit = !text || expanded || text.length <= PREVIEW_CHARS ? text?.length ?? 0 : PREVIEW_CHARS;
  const pieces: React.ReactNode[] = [];
  if (text) {
    let cursor = 0;
    map.segments.forEach((seg, i) => {
      if (seg.start >= limit) return;
      if (seg.start > cursor) pieces.push(text.slice(cursor, seg.start));
      const end = Math.min(seg.end, limit);
      const st = STYLE[seg.kind];
      pieces.push(
        <mark
          key={i}
          role="button"
          tabIndex={0}
          onClick={() => setActive(active === i ? null : i)}
          onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), setActive(active === i ? null : i))}
          title={`${st.label} — tap to see the AI source`}
          style={{
            background: st.mark,
            color: "inherit",
            borderBottom: `2px solid ${st.bar}`,
            borderRadius: 3,
            padding: "0 1px",
            cursor: "pointer",
            outline: active === i ? `2px solid ${st.bar}` : "none",
          }}
        >
          {text.slice(seg.start, end)}
        </mark>
      );
      cursor = end;
    });
    if (cursor < limit) pieces.push(text.slice(cursor, limit));
    if (limit < text.length) pieces.push("…");
  }

  return (
    <div style={{ border: "1px solid var(--lum-border)", borderRadius: 8, padding: "10px 12px", display: "flex", flexDirection: "column", gap: 10 }}>
      <div>
        <div style={{ fontWeight: 700 }}>How AI was used</div>
        {map.summary && <div style={{ marginTop: 2 }}>{map.summary}</div>}
      </div>

      {map.legacy ? (
        <div style={{ color: "var(--lum-muted)", fontSize: 12 }}>
          Analyzed before the contribution map existed — only near-exact copies were checked, and AI-assisted or
          paraphrased passages aren&apos;t shown.
        </div>
      ) : null}

      {/* Breakdown bar */}
      <div>
        <div
          role="img"
          aria-label={ORDER.map((k) => `${STYLE[k].label} ${map.percent[k]}%`).join(", ")}
          style={{ display: "flex", height: 10, borderRadius: 999, overflow: "hidden", background: STYLE.student.bar }}
        >
          {ORDER.filter((k) => map.words[k] > 0).map((k) => (
            <div key={k} style={{ width: `${(100 * map.words[k]) / Math.max(1, map.totalWords)}%`, background: STYLE[k].bar }} />
          ))}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 14px", marginTop: 6, fontSize: 12 }}>
          {ORDER.filter((k) => k === "student" || map.words[k] > 0).map((k) => (
            <span key={k} style={{ display: "inline-flex", alignItems: "center", gap: 5, color: STYLE[k].text }}>
              <span style={{ width: 9, height: 9, borderRadius: 2, background: STYLE[k].bar, display: "inline-block" }} />
              {STYLE[k].label} · <strong>{map.percent[k]}%</strong>
            </span>
          ))}
        </div>
      </div>

      {/* Highlighted submission */}
      {text ? (
        <div>
          <div style={{ fontSize: 12, color: "var(--lum-muted)", marginBottom: 4 }}>
            {hasAi ? "Submission — tap a highlighted passage to see the AI reply it came from." : "Submission"}
          </div>
          <div
            style={{
              whiteSpace: "pre-wrap",
              lineHeight: 1.6,
              background: "#fcfbf8",
              border: "1px solid var(--lum-border)",
              borderRadius: 6,
              padding: "10px 12px",
              maxHeight: expanded ? "none" : 320,
              overflow: "auto",
            }}
          >
            {pieces}
          </div>
          {text.length > PREVIEW_CHARS && (
            <button
              onClick={() => setExpanded((v) => !v)}
              style={{ background: "none", border: "none", padding: "4px 0 0", color: "var(--lum-accent)", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
            >
              {expanded ? "Show less" : "Show full submission"}
            </button>
          )}
        </div>
      ) : null}

      {/* Source for the selected passage */}
      {activeSeg && activeSrc && (
        <div style={{ background: "#f4f6fa", border: "1px solid #dde3ee", borderRadius: 6, padding: "10px 12px" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: STYLE[activeSeg.kind].text }}>
            {STYLE[activeSeg.kind].label} · {KIND_WORD[activeSrc.kind]}
            {activeSrc.disclosed ? " · disclosed by the student" : ""}
          </div>
          <div style={{ fontSize: 12, color: "var(--lum-muted)", marginTop: 6 }}>From the AI&apos;s reply in the transcript:</div>
          <blockquote style={{ margin: "4px 0 0", paddingLeft: 10, borderLeft: "3px solid #c9d3e4", fontStyle: "italic" }}>
            {activeSrc.transcriptExcerpt ?? "(source text not recorded for this older analysis)"}
          </blockquote>
        </div>
      )}

      {!map.speakersDetected && hasAi && (
        <div style={{ fontSize: 11, color: "var(--lum-muted)" }}>
          The transcript doesn&apos;t label who said what, so sources were matched against the whole conversation.
        </div>
      )}
    </div>
  );
}
