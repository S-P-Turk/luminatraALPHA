// Small inline spinner for buttons and loading rows.
export function Spinner({ size = 14, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <span
      aria-hidden
      style={{
        display: "inline-block",
        width: size,
        height: size,
        border: `2px solid ${color}`,
        borderRightColor: "transparent",
        borderRadius: "50%",
        animation: "lum-spin 0.7s linear infinite",
        verticalAlign: "-2px",
      }}
    />
  );
}

// A calm progress line for slow AI steps: spinner + message + optional hint.
export function WorkingNote({ message, hint }: { message: string; hint?: string }) {
  return (
    <div
      role="status"
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
        background: "var(--lum-amber-bg)",
        border: "1px solid #ecd9b4",
        borderRadius: 10,
        padding: "12px 14px",
        fontSize: 14,
        color: "var(--lum-ink)",
      }}
    >
      <span style={{ marginTop: 2, color: "var(--lum-accent)" }}>
        <Spinner />
      </span>
      <span>
        <strong style={{ animation: "lum-pulse 1.6s ease-in-out infinite" }}>{message}</strong>
        {hint && <span style={{ display: "block", color: "var(--lum-muted)", fontSize: 13, marginTop: 2 }}>{hint}</span>}
      </span>
    </div>
  );
}
