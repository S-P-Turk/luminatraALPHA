"use client";

import type { CSSProperties, ReactNode } from "react";

// Graph-paper admin design system: Chivo for text, Chivo Mono for data and
// labels, outlined cells on a flat background, one signal-yellow accent.

export const K = {
  bg: "#161616",
  cell: "#1C1C1B",
  line: "#3A3A38",
  grid: "#1F1F1E",
  fg: "#E8E6E1",
  mute: "#9C9A94",
  sig: "#E9D758",
  sigDim: "#4A4632",
  clay: "#E5845C",
  sage: "#9CC6A2",
  mono: "var(--font-admin-mono), ui-monospace, Menlo, monospace",
  sans: "var(--font-admin-sans), system-ui, sans-serif",
};

export const usd = (n: number | null | undefined, digits = 2) => (n == null ? "—" : `$${n.toFixed(digits)}`);
export const pct = (n: number | null | undefined) => (n == null ? "—" : `${Math.round(n * 100)}%`);

export function Cell({
  label,
  refId,
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
    <section
      id={id}
      aria-label={label}
      style={{ border: `1px solid ${K.line}`, background: K.cell, padding: "10px 12px", minWidth: 0, ...style }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, fontFamily: K.mono, fontSize: 11, color: K.mute }}>
        <span>{label}</span>
        {refId && <span>{refId}</span>}
      </div>
      <div style={{ marginTop: 8 }}>{children}</div>
    </section>
  );
}

export function Big({ children, color }: { children: ReactNode; color?: string }) {
  return (
    <div style={{ fontFamily: K.mono, fontSize: 24, lineHeight: 1.1, color: color ?? K.fg, fontVariantNumeric: "tabular-nums" }}>
      {children}
    </div>
  );
}

export function Sub({ children, color }: { children: ReactNode; color?: string }) {
  return <div style={{ fontFamily: K.mono, fontSize: 12, color: color ?? K.mute, marginTop: 4 }}>{children}</div>;
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
      style={{
        fontFamily: K.mono,
        fontSize: 12,
        color: primary ? K.bg : K.fg,
        background: primary ? K.sig : K.bg,
        border: `1px solid ${primary ? K.sig : K.line}`,
        borderRadius: 0,
        padding: "5px 10px",
        minHeight: 30,
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
      style={{
        fontFamily: K.mono,
        fontSize: 12,
        color: primary ? K.bg : K.fg,
        background: primary ? K.sig : K.bg,
        border: `1px solid ${primary ? K.sig : K.line}`,
        padding: "6px 10px",
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
    <header style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "flex-end", gap: 16 }}>
      <div>
        <div style={{ fontFamily: K.mono, fontSize: 12, color: K.mute }}>{sheet}</div>
        <h1 style={{ margin: "2px 0 0", fontFamily: K.sans, fontSize: 24, fontWeight: 700, letterSpacing: "-0.01em", color: K.fg }}>
          {title}
        </h1>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>{children}</div>
    </header>
  );
}

export function Grid({ min, children, gap = 12 }: { min: number; children: ReactNode; gap?: number }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(auto-fit, minmax(min(${min}px, 100%), 1fr))`, gap }}>{children}</div>
  );
}

export const th: CSSProperties = {
  padding: "5px 8px",
  border: `1px solid ${K.line}`,
  fontFamily: K.mono,
  fontSize: 11,
  fontWeight: 400,
  color: K.mute,
  textAlign: "left",
};
export const td: CSSProperties = { padding: "5px 8px", border: `1px solid ${K.line}`, fontSize: 12.5, color: K.fg };
export const tdMono: CSSProperties = { ...td, fontFamily: K.mono, fontSize: 12 };

export function Loading({ what = "loading" }: { what?: string }) {
  return <div style={{ fontFamily: K.mono, fontSize: 13, color: K.mute }}>{what}…</div>;
}

export function Bar({ value, max = 1, color = K.sig, height = 4 }: { value: number; max?: number; color?: string; height?: number }) {
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
