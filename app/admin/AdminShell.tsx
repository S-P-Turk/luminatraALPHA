"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { K, Btn } from "./ui";

const NAV = [
  { href: "/admin", key: "o", label: "overview" },
  { href: "/admin/lab", key: "t", label: "test-lab" },
  { href: "/admin/spending", key: "s", label: "spending" },
  { href: "/admin/quality", key: "q", label: "quality" },
];

const gridBg = {
  backgroundColor: K.bg,
  backgroundImage: `linear-gradient(${K.grid} 1px, transparent 1px), linear-gradient(90deg, ${K.grid} 1px, transparent 1px)`,
  backgroundSize: "24px 24px",
};

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
    ...gridBg,
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
          <form onSubmit={login} style={{ width: "100%", maxWidth: 360, border: `1px solid ${K.line}`, background: K.cell, padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ fontFamily: K.mono, fontSize: 14 }}>
              luminatra<span style={{ color: K.sig }}>_</span> <span style={{ color: K.mute }}>admin</span>
            </div>
            {state === "unconfigured" ? (
              <p style={{ margin: 0, fontSize: 14, color: K.mute }}>Admin access isn&apos;t set up on this deployment.</p>
            ) : (
              <>
                <label htmlFor="admin-pw" style={{ fontFamily: K.mono, fontSize: 11, color: K.mute }}>password</label>
                <input
                  id="admin-pw"
                  type="password"
                  autoFocus
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={{ background: K.bg, color: K.fg, border: `1px solid ${K.line}`, borderRadius: 0, padding: "10px 12px", fontFamily: K.mono, fontSize: 14 }}
                />
                {error && <div style={{ fontFamily: K.mono, fontSize: 12, color: K.clay }}>{error}</div>}
                <Btn type="submit" primary disabled={busy || !password}>{busy ? "checking…" : "sign in"}</Btn>
              </>
            )}
          </form>
        )}
      </div>
    );
  }

  return (
    <div style={shell}>
      <nav aria-label="Admin" style={{ flex: "1 1 200px", maxWidth: 216, boxSizing: "border-box", padding: "24px 16px", borderRight: `1px solid ${K.line}`, background: K.bg, display: "flex", flexDirection: "column", gap: 2 }}>
        <Link href="/" style={{ fontFamily: K.mono, fontSize: 14, color: K.fg, textDecoration: "none", padding: "0 10px 4px" }}>
          luminatra<span style={{ color: K.sig }}>_</span>
        </Link>
        <div style={{ fontFamily: K.mono, fontSize: 11, color: K.mute, padding: "0 10px 22px" }}>admin · prod</div>
        {NAV.map((n) => {
          const on = n.href === "/admin" ? pathname === "/admin" : pathname.startsWith(n.href);
          return (
            <Link
              key={n.href}
              href={n.href}
              aria-current={on ? "page" : undefined}
              style={{ display: "block", fontFamily: K.mono, fontSize: 13, color: on ? K.bg : K.fg, background: on ? K.sig : "transparent", textDecoration: "none", padding: "8px 10px" }}
            >
              [{n.key}] {n.label}
            </Link>
          );
        })}
        <div style={{ marginTop: "auto", paddingTop: 16, borderTop: `1px solid ${K.line}`, display: "flex", flexDirection: "column", gap: 8 }}>
          <span style={{ fontFamily: K.mono, fontSize: 11, color: K.mute, padding: "0 10px" }}>keys o · t · s · q</span>
          <button type="button" onClick={logout} style={{ textAlign: "left", fontFamily: K.mono, fontSize: 13, color: K.fg, background: "transparent", border: "none", padding: "8px 10px", cursor: "pointer" }}>
            [x] sign out
          </button>
        </div>
      </nav>
      <main style={{ flex: "999 1 560px", minWidth: 0, boxSizing: "border-box", padding: "24px clamp(16px, 4vw, 48px) 64px", display: "flex", flexDirection: "column", gap: 24 }}>
        {children}
      </main>
    </div>
  );
}
