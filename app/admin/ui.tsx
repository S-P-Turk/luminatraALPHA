"use client";

import type { CSSProperties, ReactNode } from "react";

// "Night ledger" admin design: warm near-black, hairline-ruled sections,
// serif page titles, monospace figures, one amber accent (clay for warnings).

export const K = {
  bg: "#12110F",
  side: "#0D0C0B",
  cell: "#191815",
  raised: "#201E1A",
  line: "#2C2A25",
  grid: "#22201C",
  fg: "#EEE8DB",
  mute: "#A59E90",
  dim: "#8A8476",
  sig: "#E6AC5C",
  sigDim: "#5A4724",
  onSig: "#1A1306",
  clay: "#E5845C",
  sage: "#9CC6A2",
  mono: "var(--font-admin-mono), ui-monospace, Menlo, monospace",
  sans: "var(--font-sans), Inter, system-ui, sans-serif",
  serif: "var(--font-serif), 'Source Serif 4', Georgia, serif",
};

export const usd = (n: number | null | undefined, digits = 2) => (n == null ? "—" : `$${n.toFixed(digits)}`);
export const pct = (n: number | null | undefined) => (n == null ? "—" : `${Math.round(n * 100)}%`);

export function Cell({
  label,
  children,
  style,
  id,
}: {
  label: string;
  refId?: string;
  children: ReactNode;
  style?: CSSProperties;
  id?: string;
}) {
  return (
    <section id={id} aria-label={label} style={{ borderTop: `1px solid ${K.line}`, padding: "14px 0 4px", minWidth: 0, ...style }}>
      <div style={{ fontFamily: K.mono, fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: K.dim }}>{label}</div>
      <div style={{ marginTop: 12 }}>{children}</div>
    </section>
  );
}

export function Big({ children, color }: { children: ReactNode; color?: string }) {
  return (
    <div style={{ fontFamily: K.mono, fontSize: 34, fontWeight: 500, lineHeight: 1, color: color ?? K.fg, fontVariantNumeric: "tabular-nums" }}>
      {children}
    </div>
  );
}

export function Sub({ children, color }: { children: ReactNode; color?: string }) {
  return <div style={{ fontFamily: K.sans, fontSize: 13, color: color ?? K.mute, marginTop: 8 }}>{children}</div>;
}

export function Spark({ values, width = 140, height = 32, color = K.sig }: { values: number[]; width?: number; height?: number; color?: string }) {
  if (values.length < 2) return null;
  const max = Math.max(1, ...values);
  const pts = values.map((v, i) => `${((i / (values.length - 1)) * width).toFixed(1)},${(height - (v / max) * height).toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} aria-hidden="true">
      <polyline fill="none" stroke={color} strokeWidth="1.5" points={pts} />
    </svg>
  );
}

export function Btn({
  children,
  onClick,
  primary,
  disabled,
  type = "button",
  title,
}: {
  children: ReactNode;
  onClick?: () => void;
  primary?: boolean;
  disabled?: boolean;
  type?: "button" | "submit";
  title?: string;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="adm-cap"
      style={{
        fontFamily: K.sans,
        fontSize: 14,
        fontWeight: primary ? 600 : 500,
        color: primary ? K.onSig : K.fg,
        background: primary ? K.sig : "transparent",
        border: `1px solid ${primary ? K.sig : K.line}`,
        borderRadius: 6,
        padding: "9px 14px",
        minHeight: 40,
        cursor: disabled ? "default" : "pointer",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </button>
  );
}

export function LinkBtn({ href, children, primary }: { href: string; children: ReactNode; primary?: boolean }) {
  return (
    <a
      href={href}
      className="adm-cap"
      style={{
        fontFamily: K.sans,
        fontSize: 14,
        fontWeight: primary ? 600 : 500,
        color: primary ? K.onSig : K.fg,
        background: primary ? K.sig : "transparent",
        border: `1px solid ${primary ? K.sig : K.line}`,
        borderRadius: 6,
        padding: "10px 14px",
        textDecoration: "none",
        whiteSpace: "nowrap",
        display: "inline-block",
      }}
    >
      {children}
    </a>
  );
}

export function Header({
  sheet,
  title,
  children,
}: {
  sheet: string;
  title: string;
  children?: ReactNode;
}) {
  return (
    <header style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "flex-end", gap: 16, paddingBottom: 20, borderBottom: `1px solid ${K.line}` }}>
      <div>
        <div style={{ fontFamily: K.mono, fontSize: 12, color: K.dim }}>{sheet}</div>
        <h1 style={{ margin: "8px 0 0", fontFamily: K.serif, fontSize: 34, fontWeight: 500, letterSpacing: "-0.01em", color: K.fg }}>
          {title}
        </h1>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>{children}</div>
    </header>
  );
}

export function Grid({ min, children, gap = 40 }: { min: number; children: ReactNode; gap?: number }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(auto-fit, minmax(min(${min}px, 100%), 1fr))`, gap }}>{children}</div>
  );
}

export const th: CSSProperties = {
  padding: "0 16px 10px 0",
  borderBottom: `1px solid ${K.line}`,
  fontFamily: K.mono,
  fontSize: 11,
  fontWeight: 500,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  color: K.dim,
  textAlign: "left",
};
export const td: CSSProperties = { padding: "11px 16px 11px 0", borderBottom: `1px solid ${K.line}`, fontSize: 14, color: K.fg };
export const tdMono: CSSProperties = { ...td, fontFamily: K.mono, fontSize: 12 };

export function Loading({ what = "loading" }: { what?: string }) {
  return <div style={{ fontFamily: K.mono, fontSize: 13, color: K.mute }}>{what}…</div>;
}

export function Bar({ value, max = 1, color = K.sig, height = 3 }: { value: number; max?: number; color?: string; height?: number }) {
  return (
    <div style={{ height, background: K.grid }}>
      <div style={{ width: `${Math.max(0, Math.min(100, (value / max) * 100))}%`, height, background: color }} />
    </div>
  );
}

export function timeAgo(iso: string): string {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 90) return "just now";
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return `${Math.round(s / 86400)} d ago`;
}
