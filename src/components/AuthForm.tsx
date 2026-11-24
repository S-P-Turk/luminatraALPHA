"use client";

import { useLayoutEffect, useState } from "react";
import Link from "next/link";
import { Spinner } from "./Spinner";

type Role = "teacher" | "student";
type Step = "email" | "sign_in" | "set_password" | "new";

const input: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  border: "1px solid var(--lum-border-strong)",
  borderRadius: 8,
  fontSize: 15,
  background: "#fff",
  color: "var(--lum-ink)",
};
const label: React.CSSProperties = { fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6 };

// Two-step sign-in shared by teachers and students: email first, then
// either the password, or creating one (new accounts, and accounts from
// before passwords existed).
export function AuthForm({ role }: { role: Role }) {
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Next.js keeps recently visited pages alive in the background (React
  // Activity), so without this the form would come back on its old step
  // (e.g. "Create your password") after signing out. Reset whenever the
  // form is hidden, so every visit starts fresh at the email step.
  useLayoutEffect(() => {
    return () => {
      setStep("email");
      setEmail("");
      setName("");
      setPassword("");
      setConfirm("");
      setShow(false);
      setError(null);
      setLoading(false);
    };
  }, []);

  const creating = step === "set_password" || step === "new";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (step === "email") {
      setLoading(true);
      try {
        const res = await fetch("/api/auth/lookup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role, email }),
        });
        const data = await res.json();
        if (!res.ok) return setError(data.error ?? "Something went wrong.");
        setStep(data.next);
      } catch {
        setError("Couldn't reach the server. Check your connection and try again.");
      } finally {
        setLoading(false);
      }
      return;
    }

    if (creating && password !== confirm) return setError("Those passwords don't match.");
    if (creating && password.length < 8) return setError("Use at least 8 characters.");
    if (step === "new" && role === "student" && !name.trim()) return setError("Enter your name.");

    setLoading(true);
    try {
      const res = await fetch(role === "teacher" ? "/api/auth/login" : "/api/auth/student-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, name }),
      });
      const data = await res.json();
      if (!res.ok) return setError(data.error ?? "Something went wrong.");
      // Full page load, not router.push: Next.js keeps recently visited pages
      // alive in the background, and a soft navigation could briefly show the
      // previous account's data under the new one.
      window.location.assign(role === "teacher" ? "/classes" : "/student");
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  const title =
    step === "email"
      ? role === "teacher"
        ? "Teacher sign in"
        : "Student sign in"
      : step === "sign_in"
        ? "Enter your password"
        : step === "set_password"
          ? "Create your password"
          : "Create your account";

  const subtitle =
    step === "email"
      ? role === "teacher"
        ? "Review AI use and comprehension across your classes."
        : "Submit your work and see what your teacher needs from you."
      : step === "set_password"
        ? "Your account is now protected by a password. Choose one to continue."
        : step === "new"
          ? "First time here — set up your account."
          : email;

  return (
    <main
      style={{
        minHeight: "calc(100vh - 57px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "32px 20px",
      }}
    >
      <form
        onSubmit={submit}
        style={{
          width: "100%",
          maxWidth: 400,
          background: "#fff",
          border: "1px solid var(--lum-border)",
          borderRadius: 14,
          padding: "28px 26px",
          display: "flex",
          flexDirection: "column",
          gap: 16,
          boxShadow: "0 8px 30px #1e22300d",
        }}
      >
        <div>
          <div
            style={{
              fontSize: 12,
              fontWeight: 600,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: "var(--lum-accent)",
            }}
          >
            {role === "teacher" ? "For teachers" : "For students"}
          </div>
          <h1 style={{ margin: "4px 0 0", fontSize: 26 }}>{title}</h1>
          <p style={{ margin: "6px 0 0", fontSize: 14, color: "var(--lum-muted)" }}>{subtitle}</p>
        </div>

        {step === "email" ? (
          <div>
            <label style={label} htmlFor="email">
              {role === "student" ? "School email" : "Email"}
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              autoFocus
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={input}
            />
          </div>
        ) : (
          <>
            {step === "new" && role === "student" && (
              <div>
                <label style={label} htmlFor="name">
                  Your name
                </label>
                <input
                  id="name"
                  autoComplete="name"
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  style={input}
                />
                <div style={{ fontSize: 12, color: "var(--lum-muted)", marginTop: 4 }}>
                  As your teacher would recognize it.
                </div>
              </div>
            )}
            <div>
              <label style={label} htmlFor="password">
                {creating ? "New password" : "Password"}
              </label>
              <div style={{ position: "relative" }}>
                <input
                  id="password"
                  type={show ? "text" : "password"}
                  autoComplete={creating ? "new-password" : "current-password"}
                  autoFocus={!(step === "new" && role === "student")}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={{ ...input, paddingRight: 60 }}
                />
                <button
                  type="button"
                  onClick={() => setShow((v) => !v)}
                  style={{
                    position: "absolute",
                    right: 6,
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "none",
                    border: "none",
                    color: "var(--lum-accent)",
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                    padding: "4px 6px",
                  }}
                >
                  {show ? "Hide" : "Show"}
                </button>
              </div>
              {creating && (
                <div style={{ fontSize: 12, color: "var(--lum-muted)", marginTop: 4 }}>At least 8 characters.</div>
              )}
            </div>
            {creating && (
              <div>
                <label style={label} htmlFor="confirm">
                  Confirm password
                </label>
                <input
                  id="confirm"
                  type={show ? "text" : "password"}
                  autoComplete="new-password"
                  required
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  style={input}
                />
              </div>
            )}
          </>
        )}

        {error && (
          <div
            role="alert"
            style={{
              fontSize: 13,
              color: "#7a2e22",
              background: "#fbe9e5",
              borderRadius: 8,
              padding: "8px 10px",
            }}
          >
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          style={{
            background: "var(--lum-ink)",
            color: "#fff",
            border: "none",
            borderRadius: 8,
            padding: "11px 16px",
            fontSize: 15,
            fontWeight: 600,
            cursor: "pointer",
            display: "inline-flex",
            justifyContent: "center",
            alignItems: "center",
            gap: 8,
          }}
        >
          {loading && <Spinner />}
          {step === "email" ? "Continue" : creating ? "Save password & sign in" : "Sign in"}
        </button>

        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 13 }}>
          {step === "email" ? (
            <Link
              href={role === "teacher" ? "/student/login" : "/login"}
              style={{ color: "var(--lum-muted)", textDecoration: "none" }}
            >
              {role === "teacher" ? "I'm a student →" : "I'm a teacher →"}
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => {
                setStep("email");
                setPassword("");
                setConfirm("");
                setError(null);
              }}
              style={{ background: "none", border: "none", padding: 0, color: "var(--lum-muted)", fontSize: 13, cursor: "pointer" }}
            >
              ← Use a different email
            </button>
          )}
          {step === "sign_in" && (
            <span style={{ color: "var(--lum-muted)" }}>
              {role === "student" ? "Forgot it? Ask your teacher to reset it." : "Forgot it? Contact Luminatra."}
            </span>
          )}
        </div>
      </form>
    </main>
  );
}
