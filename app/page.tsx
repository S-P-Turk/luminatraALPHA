import Link from "next/link";

const colors = {
  bg: "#F7F5F0",
  ink: "#1E2230",
  muted: "#6B7080",
  accent: "#8A5A3B",
  border: "#E7E2D8",
};

export default function Home() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: colors.bg,
        fontFamily: "Inter, system-ui, sans-serif",
        color: colors.ink,
        padding: 24,
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 36, maxWidth: 480 }}>
        <div style={{ textAlign: "center" }}>
          <div
            style={{
              fontSize: 13,
              fontWeight: 600,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: colors.accent,
            }}
          >
            Luminatra
          </div>
          <h1 style={{ margin: "6px 0 0", fontSize: 26, fontWeight: 600 }}>Sign in</h1>
          <p style={{ margin: "8px 0 0", fontSize: 14, color: colors.muted }}>
            Choose how you&apos;re joining.
          </p>
        </div>

        <div style={{ display: "flex", gap: 16, width: "100%" }}>
          <Link
            href="/login"
            style={{
              flex: 1,
              background: "#fff",
              border: `1px solid ${colors.border}`,
              borderRadius: 12,
              padding: "28px 20px",
              textAlign: "center",
              textDecoration: "none",
              color: colors.ink,
              display: "flex",
              flexDirection: "column",
              gap: 6,
            }}
          >
            <span style={{ fontSize: 16, fontWeight: 600 }}>Teacher</span>
            <span style={{ fontSize: 13, color: colors.muted }}>Manage classes &amp; review</span>
          </Link>

          <Link
            href="/student/login"
            style={{
              flex: 1,
              background: "#fff",
              border: `1px solid ${colors.border}`,
              borderRadius: 12,
              padding: "28px 20px",
              textAlign: "center",
              textDecoration: "none",
              color: colors.ink,
              display: "flex",
              flexDirection: "column",
              gap: 6,
            }}
          >
            <span style={{ fontSize: 16, fontWeight: 600 }}>Student</span>
            <span style={{ fontSize: 13, color: colors.muted }}>Join with a class code</span>
          </Link>
        </div>
      </div>
    </main>
  );
}
