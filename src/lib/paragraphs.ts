// Splits a submission into paragraphs with character offsets. Shared by the
// analyzer prompt (which numbers paragraphs) and the reliance scoring (which
// maps the analyzer's per-paragraph ratings back onto the text).

export type Paragraph = { index: number; start: number; end: number; text: string };

export function splitParagraphs(text: string): Paragraph[] {
  const out: Paragraph[] = [];
  // Prefer blank-line breaks; fall back to single newlines if the student
  // pasted without blank lines.
  const sep = /\n\s*\n/.test(text) ? /\n\s*\n/g : /\n/g;
  let cursor = 0;
  const push = (from: number, to: number) => {
    const raw = text.slice(from, to);
    const lead = raw.length - raw.trimStart().length;
    const trimmed = raw.trim();
    if (trimmed) out.push({ index: out.length + 1, start: from + lead, end: from + lead + trimmed.length, text: trimmed });
  };
  for (const m of text.matchAll(sep)) {
    push(cursor, m.index!);
    cursor = m.index! + m[0].length;
  }
  push(cursor, text.length);
  return out;
}

export function numberedParagraphs(text: string): string {
  return splitParagraphs(text)
    .map((p) => `[${p.index}] ${p.text}`)
    .join("\n\n");
}
