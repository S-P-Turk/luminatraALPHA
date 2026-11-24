import Link from "next/link";

// Public home page — doubles as the link to share in outreach.

const steps = [
  {
    n: "1",
    title: "Students disclose",
    body: "With their work, students submit the transcript of how they used AI. No hidden detectors, no guessing.",
  },
  {
    n: "2",
    title: "Luminatra checks",
    body: "It compares the disclosed AI use with the syllabus rules and the submitted text, then gives a short comprehension check on the parts students say they did themselves.",
  },
  {
    n: "3",
    title: "Teachers decide",
    body: "Teachers see a follow-up priority with plain reasons, and choose to follow up or clear. Nothing is ever an automatic verdict.",
  },
];

const principles = [
  {
    title: "Disclosure over detection",
    body: "AI detectors guess and misfire. Luminatra works from what students actually show, so the conversation starts from evidence.",
  },
  {
    title: "Suggests, never accuses",
    body: "Every flag is a suggestion to look closer, with the reasons spelled out. A human always makes the call.",
  },
  {
    title: "Understanding is the point",
    body: "The comprehension check asks whether students can explain their own work — the thing integrity policies are meant to protect.",
  },
];

export default function Home() {
  return (
    <main style={{ minHeight: "calc(100vh - 57px)", color: "var(--lum-ink)" }}>
      {/* Hero */}
      <section style={{ maxWidth: 1040, margin: "0 auto", padding: "72px 20px 56px" }}>
        <div style={{ maxWidth: 680 }}>
          <div
            style={{
              fontSize: 12,
              fontWeight: 600,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "var(--lum-accent)",
            }}
          >
            AI use analyzer for courses
          </div>
          <h1 style={{ margin: "12px 0 0", fontSize: "clamp(34px, 6vw, 54px)", lineHeight: 1.08 }}>
            See how students used AI — and whether they understand their own work.
          </h1>
          <p style={{ margin: "18px 0 0", fontSize: 18, lineHeight: 1.55, color: "var(--lum-muted)", maxWidth: 580 }}>
            Luminatra turns AI disclosure into a fair, evidence-based review. Students show their AI conversations,
            Luminatra checks them against your syllabus, and you decide what deserves a follow-up.
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 28 }}>
            <Link
              href="/login"
              style={{
                background: "var(--lum-ink)",
                color: "#fff",
                textDecoration: "none",
                padding: "12px 20px",
                borderRadius: 10,
                fontSize: 15,
                fontWeight: 600,
              }}
            >
              I&apos;m a teacher
            </Link>
            <Link
              href="/student/login"
              style={{
                background: "#fff",
                color: "var(--lum-ink)",
                textDecoration: "none",
                padding: "12px 20px",
                borderRadius: 10,
                fontSize: 15,
                fontWeight: 600,
                border: "1px solid var(--lum-border-strong)",
              }}
            >
              I&apos;m a student
            </Link>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section style={{ background: "#fff", borderTop: "1px solid var(--lum-border)", borderBottom: "1px solid var(--lum-border)" }}>
        <div style={{ maxWidth: 1040, margin: "0 auto", padding: "56px 20px" }}>
          <h2 style={{ margin: 0, fontSize: 28 }}>How it works</h2>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
              gap: 20,
              marginTop: 24,
            }}
          >
            {steps.map((s) => (
              <div key={s.n} style={{ display: "flex", gap: 14 }}>
                <span
                  style={{
                    flexShrink: 0,
                    width: 32,
                    height: 32,
                    borderRadius: "50%",
                    background: "var(--lum-amber-bg)",
                    color: "var(--lum-accent)",
                    fontFamily: "var(--font-serif), Georgia, serif",
                    fontWeight: 700,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {s.n}
                </span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 16 }}>{s.title}</div>
                  <p style={{ margin: "6px 0 0", fontSize: 14, lineHeight: 1.55, color: "var(--lum-muted)" }}>{s.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Principles */}
      <section style={{ maxWidth: 1040, margin: "0 auto", padding: "56px 20px 40px" }}>
        <h2 style={{ margin: 0, fontSize: 28 }}>What we believe</h2>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: 16,
            marginTop: 24,
          }}
        >
          {principles.map((p) => (
            <div
              key={p.title}
              style={{
                background: "#fff",
                border: "1px solid var(--lum-border)",
                borderRadius: 12,
                padding: "18px 20px",
              }}
            >
              <div style={{ fontFamily: "var(--font-serif), Georgia, serif", fontSize: 19, fontWeight: 600 }}>{p.title}</div>
              <p style={{ margin: "8px 0 0", fontSize: 14, lineHeight: 1.55, color: "var(--lum-muted)" }}>{p.body}</p>
            </div>
          ))}
        </div>
      </section>

      <footer
        style={{
          maxWidth: 1040,
          margin: "0 auto",
          padding: "24px 20px 40px",
          fontSize: 13,
          color: "var(--lum-muted)",
          display: "flex",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 8,
        }}
      >
        <span>© 2026 Luminatra · Beta</span>
        <span>Built for academic integrity offices, faculty and students.</span>
      </footer>
    </main>
  );
}
