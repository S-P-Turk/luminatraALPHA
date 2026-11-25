"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { K, Btn } from "./ui";

const NAV = [
  { href: "/admin", key: "o", num: "01", label: "Overview" },
  { href: "/admin/lab", key: "t", num: "02", label: "Test lab" },
  { href: "/admin/spending", key: "s", num: "03", label: "API spending" },
  { href: "/admin/quality", key: "q", num: "04", label: "Model quality" },
];

function Mark() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true">
      <circle cx="11" cy="11" r="10" fill="none" stroke={K.sig} strokeWidth="1.5" />
      <path d="M11 4.5 L12.6 9.4 L17.5 11 L12.6 12.6 L11 17.5 L9.4 12.6 L4.5 11 L9.4 9.4 Z" fill={K.sig} />
    </svg>
  );
}

export default function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "/admin";
  const router = useRouter();
  const [state, setState] = useState<"loading" | "in" | "out" | "unconfigured">("loading");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const check = useCallback(async () => {
    const r = await fetch("/api/admin/me").then((x) => x.json()).catch(() => ({ admin: false, configured: true }));
    setState(r.admin ? "in" : r.configured ? "out" : "unconfigured");
  }, []);

  useEffect(() => {
    void check();
  }, [check]);

  // Keyboard shortcuts: o / t / s / q jump between sheets (not while typing).
  useEffect(() => {
    if (state !== "in") return;
    function onKey(e: KeyboardEvent) {
      const el = e.target as HTMLElement;
      if (e.metaKey || e.ctrlKey || e.altKey || el.closest("input, textarea, select, [contenteditable]")) return;
      const item = NAV.find((n) => n.key === e.key);
      if (item) router.push(item.href);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [state, router]);

  async function login(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    setBusy(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? "Couldn't sign in.");
      return;
    }
    setPassword("");
    setState("in");
  }

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    window.location.assign("/admin");
  }

  const shell: React.CSSProperties = {
    background: K.bg,
    minHeight: "100vh",
    width: "100%",
    color: K.fg,
    fontFamily: K.sans,
    display: "flex",
    flexWrap: "wrap",
  };

  if (state !== "in") {
    return (
      <div style={{ ...shell, alignItems: "center", justifyContent: "center", padding: 24, boxSizing: "border-box" }}>
        {state === "loading" ? (
          <span style={{ fontFamily: K.mono, fontSize: 13, color: K.mute }}>checking access…</span>
        ) : (
          <form onSubmit={login} style={{ width: "100%", maxWidth: 360, border: `1px solid ${K.line}`, borderRadius: 10, background: K.cell, padding: 24, display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Mark />
              <span style={{ fontFamily: K.serif, fontSize: 20, fontWeight: 600 }}>Luminatra</span>
              <span style={{ fontFamily: K.mono, fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: K.dim }}>Admin</span>
            </div>
            {state === "unconfigured" ? (
              <p style={{ margin: 0, fontSize: 14, color: K.mute }}>Admin access isn&apos;t set up on this deployment.</p>
            ) : (
              <>
                <label htmlFor="admin-pw" style={{ fontFamily: K.mono, fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: K.dim }}>Password</label>
                <input
                  id="admin-pw"
                  type="password"
                  autoFocus
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={{ background: K.side, color: K.fg, border: `1px solid ${K.line}`, borderRadius: 6, padding: "10px 12px", fontFamily: K.mono, fontSize: 14 }}
                />
                {error && <div style={{ fontFamily: K.mono, fontSize: 12, color: K.clay }}>{error}</div>}
                <Btn type="submit" primary disabled={busy || !password}>{busy ? "Checking…" : "Sign in"}</Btn>
              </>
            )}
          </form>
        )}
      </div>
    );
  }

  return (
    <div style={shell}>
      <nav aria-label="Admin" style={{ flex: "1 1 220px", maxWidth: 232, boxSizing: "border-box", padding: "22px 12px", background: K.side, borderRight: `1px solid ${K.line}`, display: "flex", flexDirection: "column", gap: 2 }}>
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: 10, padding: "2px 12px 22px", textDecoration: "none", color: K.fg }}>
          <Mark />
          <span style={{ fontFamily: K.serif, fontSize: 19, fontWeight: 600 }}>Luminatra</span>
        </Link>
        <div style={{ fontFamily: K.mono, fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: K.dim, padding: "0 12px 8px" }}>Admin</div>
        {NAV.map((n) => {
          const on = n.href === "/admin" ? pathname === "/admin" : pathname.startsWith(n.href);
          return (
            <Link
              key={n.href}
              href={n.href}
              aria-current={on ? "page" : undefined}
              style={{ display: "flex", alignItems: "center", gap: 12, padding: "9px 12px", borderRadius: 6, background: on ? K.raised : "transparent", color: on ? K.fg : K.mute, fontFamily: K.sans, fontSize: 14, fontWeight: 500, textDecoration: "none" }}
            >
              <span style={{ fontFamily: K.mono, fontSize: 11, color: on ? K.sig : K.dim, width: 18 }}>{n.num}</span>
              {n.label}
            </Link>
          );
        })}
        <div style={{ marginTop: "auto", padding: "16px 12px 0", borderTop: `1px solid ${K.line}`, display: "flex", flexDirection: "column", gap: 10 }}>
          <span style={{ fontFamily: K.mono, fontSize: 11, color: K.dim }}>keys · o t s q</span>
          <button type="button" onClick={logout} style={{ alignSelf: "flex-start", fontFamily: K.sans, fontSize: 13, fontWeight: 500, color: K.fg, background: "transparent", border: `1px solid ${K.line}`, borderRadius: 6, padding: "7px 12px", cursor: "pointer" }}>
            Sign out
          </button>
        </div>
      </nav>
      <main style={{ flex: "999 1 560px", minWidth: 0, boxSizing: "border-box", padding: "30px clamp(16px, 4vw, 44px) 64px", display: "flex", flexDirection: "column", gap: 28 }}>
        {children}
      </main>
    </div>
  );
}
