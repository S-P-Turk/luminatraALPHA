import { createHmac, timingSafeEqual } from "node:crypto";

// Signed session cookies: "<base64url payload>.<base64url HMAC>". Without the
// signature anyone could edit their cookie to become another user, which
// would make passwords pointless. Needs SESSION_SECRET in the environment.

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error("SESSION_SECRET is not set.");
  return s;
}

function mac(data: string): string {
  return createHmac("sha256", secret()).update(data).digest("base64url");
}

export function signSession(payload: object): string {
  const data = Buffer.from(JSON.stringify({ ...payload, iat: Date.now() })).toString("base64url");
  return `${data}.${mac(data)}`;
}

export function readSession<T>(token: string | undefined): T | null {
  if (!token) return null;
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const data = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  let expected: string;
  try {
    expected = mac(data);
  } catch {
    return null;
  }
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    return JSON.parse(Buffer.from(data, "base64url").toString()) as T;
  } catch {
    return null;
  }
}

export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 24 * 30, // 30 days
};
