"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

type Session = { teacher: string | null; student: { name: string; email: string } | null; admin: boolean };

function Wordmark() {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
      <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden>
        <circle cx="11" cy="11" r="10" fill="var(--lum-ink)" />
        <path d="M11 4.5 L12.6 9.4 L17.5 11 L12.6 12.6 L11 17.5 L9.4 12.6 L4.5 11 L9.4 9.4 Z" fill="#f2d8a7" />
      </svg>
      <span
        style={{
          fontFamily: "var(--font-serif), Georgia, serif",
          fontSize: 20,
          fontWeight: 600,
          letterSpacing: "-0.01em",
          color: "var(--lum-ink)",
        }}
      >
        Luminatra
      </span>
    </span>
  );
}

function NavLink({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      style={{
        fontSize: 14,
        fontWeight: 600,
        textDecoration: "none",
        color: active ? "var(--lum-ink)" : "var(--lum-muted)",
        padding: "6px 10px",
        borderRadius: 6,
        background: active ? "#ece8de" : "transparent",
      }}
    >
      {label}
    </Link>
  );
}

// One header on every page. Which links show depends on where you are and
// who is signed in.
export function AppHeader() {
  const pathname = usePathname() ?? "/";
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/auth/session")
      .then((r) => r.json())
      .then((s) => !cancelled && setSession(s))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  const area = pathname.startsWith("/student")
    ? "student"
    : pathname.startsWith("/classes") || pathname.startsWith("/review")
      ? "teacher"
      : pathname.startsWith("/admin")
        ? "admin"
        : "public";

  async function signOut() {
    await fetch(area === "student" ? "/api/auth/student-logout" : "/api/auth/logout", { method: "POST" });
    setSession(null);
    // Full page load to a fresh sign-in screen for the same role. This drops
    // every page Next.js kept alive in the background, so nothing from this
    // account can show up for whoever signs in next on this browser.
    window.location.assign(area === "student" ? "/student/login" : "/login");
  }

  const home = area === "student" && session?.student ? "/student" : area === "teacher" && session?.teacher ? "/classes" : "/";
  const who = area === "student" ? session?.student?.name : area === "teacher" ? session?.teacher : null;

  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 50,
        background: "#f7f5f0ee",
        backdropFilter: "blur(6px)",
        borderBottom: "1px solid var(--lum-border)",
      }}
    >
      <div
        style={{
          maxWidth: 1040,
          margin: "0 auto",
          height: 56,
          padding: "0 20px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18, minWidth: 0 }}>
          <Link href={home} style={{ textDecoration: "none" }} aria-label="Luminatra home">
            <Wordmark />
          </Link>
          <nav style={{ display: "flex", gap: 2 }}>
            {area === "teacher" && session?.teacher && (
              <>
                <NavLink href="/classes" label="Classes" active={pathname.startsWith("/classes")} />
                <NavLink href="/review" label="Review" active={pathname.startsWith("/review")} />
              </>
            )}
            {area === "student" && session?.student && (
              <NavLink href="/student" label="My classes" active={pathname === "/student" || pathname.startsWith("/student/classes")} />
            )}
            {area === "admin" && <NavLink href="/admin" label="Admin" active />}
          </nav>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 13 }}>
          {who && (
            <span
              style={{
                color: "var(--lum-muted)",
                maxWidth: 200,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
              className="lum-hide-sm"
            >
              {who}
            </span>
          )}
          {(area === "teacher" || area === "student") && who && (
            <button
              onClick={signOut}
              style={{
                background: "#fff",
                color: "var(--lum-ink)",
                border: "1px solid var(--lum-border-strong)",
                borderRadius: 8,
                padding: "6px 12px",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              Sign out
            </button>
          )}
          {area === "public" && (
            <>
              <Link href="/login" style={{ fontSize: 14, fontWeight: 600, color: "var(--lum-muted)", textDecoration: "none" }}>
                Teachers
              </Link>
              <Link
                href="/student/login"
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: "#fff",
                  background: "var(--lum-ink)",
                  textDecoration: "none",
                  padding: "7px 14px",
                  borderRadius: 8,
                }}
              >
                Students
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
