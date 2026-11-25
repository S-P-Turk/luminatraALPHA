// Removes a student's own name and email from text before it is sent to the
// AI provider. The originals stay in our database; the teacher always sees
// the real text. Analysis output is mapped back with restore() so excerpts
// still line up with what the student wrote.

const TOKEN = "[STUDENT]";
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export type Identity = { name?: string | null; email?: string | null };

function patterns({ name, email }: Identity): RegExp[] {
  const out: RegExp[] = [];
  if (email) out.push(new RegExp(escape(email), "gi"));
  const parts = (name ?? "").split(/\s+/).filter((p) => p.replace(/[^\p{L}]/gu, "").length >= 3);
  // Full name first so "Anthony Blackwood" becomes one token, not two.
  if (parts.length > 1) out.push(new RegExp(`\\b${parts.map(escape).join("\\s+")}\\b`, "giu"));
  for (const p of parts) out.push(new RegExp(`(?<![\\p{L}])${escape(p)}(?![\\p{L}])`, "giu"));
  return out;
}

export function redact(text: string, who: Identity): string {
  return patterns(who).reduce((t, re) => t.replace(re, TOKEN), text);
}

/** Puts the student's first name back into model output (quiz questions, excerpts). */
export function restore<T>(value: T, who: Identity): T {
  const first = (who.name ?? "").split(/\s+/)[0];
  if (!first) return value;
  return JSON.parse(JSON.stringify(value).split(TOKEN).join(first.replace(/["\\]/g, ""))) as T;
}
