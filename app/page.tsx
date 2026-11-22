"use client";

import { useState } from "react";

type QuizQuestion = {
  question: string;
  what_it_tests: string;
};

type QuizResult = {
  policy_summary: string;
  policy_concern: string | null;
  claimed_unassisted_areas: string[];
  quiz: QuizQuestion[];
};

export default function Home() {
  const [transcript, setTranscript] = useState("");
  const [syllabus, setSyllabus] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<QuizResult | null>(null);
  const [usage, setUsage] = useState<{ input_tokens: number; output_tokens: number } | null>(null);

  async function handleSubmit() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/generate-quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript, syllabus }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong.");
      setResult(data.result);
      setUsage(data.usage);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100 p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">AI Integrity Check — Prototype</h1>
          <p className="text-neutral-400 text-sm mt-1">
            Paste a syllabus AI-use policy and a student&apos;s AI conversation transcript to generate a comprehension quiz.
          </p>
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium text-neutral-300">Syllabus AI-use policy</label>
          <textarea
            className="w-full h-32 rounded-md bg-neutral-900 border border-neutral-700 p-3 text-sm"
            placeholder="Paste the relevant syllabus text here..."
            value={syllabus}
            onChange={(e) => setSyllabus(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium text-neutral-300">Student&apos;s AI conversation transcript</label>
          <textarea
            className="w-full h-48 rounded-md bg-neutral-900 border border-neutral-700 p-3 text-sm"
            placeholder="Paste the AI transcript here..."
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
          />
        </div>

        <button
          onClick={handleSubmit}
          disabled={loading || !transcript || !syllabus}
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium disabled:opacity-40"
        >
          {loading ? "Generating..." : "Generate Quiz"}
        </button>

        {error && (
          <div className="rounded-md bg-red-950 border border-red-800 p-3 text-sm text-red-300">
            {error}
          </div>
        )}

        {result && (
          <div className="space-y-4 rounded-md bg-neutral-900 border border-neutral-700 p-4">
            <div>
              <h2 className="text-sm font-semibold text-neutral-300">Policy summary</h2>
              <p className="text-sm text-neutral-400 mt-1">{result.policy_summary}</p>
            </div>

            {result.policy_concern && (
              <div>
                <h2 className="text-sm font-semibold text-amber-400">Policy mismatch flagged</h2>
                <p className="text-sm text-amber-300 mt-1">{result.policy_concern}</p>
              </div>
            )}

            <div>
              <h2 className="text-sm font-semibold text-neutral-300">Claimed unassisted areas</h2>
              <ul className="list-disc list-inside text-sm text-neutral-400 mt-1">
                {result.claimed_unassisted_areas.map((a, i) => (
                  <li key={i}>{a}</li>
                ))}
              </ul>
            </div>

            <div>
              <h2 className="text-sm font-semibold text-neutral-300">Quiz</h2>
              <ol className="list-decimal list-inside space-y-3 mt-2">
                {result.quiz.map((q, i) => (
                  <li key={i} className="text-sm">
                    <span className="text-neutral-100">{q.question}</span>
                    <div className="text-xs text-neutral-500 mt-0.5">Tests: {q.what_it_tests}</div>
                  </li>
                ))}
              </ol>
            </div>

            {usage && (
              <div className="text-xs text-neutral-500 border-t border-neutral-800 pt-2">
                Tokens used — input: {usage.input_tokens}, output: {usage.output_tokens}
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
