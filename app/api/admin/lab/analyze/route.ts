import { NextResponse } from "next/server";
import { requireAdmin } from "@/src/lib/admin-auth";
import { generateQuiz, gradeAnswers, type QuizResult } from "@/src/lib/quiz";
import { scoreSubmission } from "@/src/lib/scoring";
import { simulateAnswers } from "@/src/lib/eval/run-case";
import { withAiContext } from "@/src/lib/ai";

export const maxDuration = 300;

// Test lab: run the full model on pasted inputs. Nothing is saved as a
// submission or shown to any teacher; the calls are logged as "lab" spend.
//   mode "good" | "vague": the quiz is answered by a simulated student.
//   mode "custom": first call returns the quiz; send it back with answers.
export async function POST(request: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const body = await request.json().catch(() => null);
  const syllabus = String(body?.syllabus ?? "").trim();
  const transcript = String(body?.transcript ?? "").trim();
  const submission = String(body?.submission ?? "").trim();
  const mode = body?.mode === "vague" ? "vague" : body?.mode === "custom" ? "custom" : "good";
  if (!syllabus || !submission) {
    return NextResponse.json({ error: "Add the syllabus AI policy and the submitted work." }, { status: 400 });
  }

  const tally = { costUsd: 0, calls: 0 };
  const started = Date.now();
  try {
    const result = await withAiContext({ step: "lab", tally }, async () => {
      const quiz: QuizResult =
        body?.quiz && Array.isArray(body.quiz?.quiz)
          ? body.quiz
          : await generateQuiz(transcript || "(no AI transcript provided)", `COURSE SYLLABUS / AI-USE POLICY:\n${syllabus}`, submission);
      let answers: string[] | null = null;
      if (mode === "custom") {
        answers = Array.isArray(body?.answers) ? body.answers.map((a: unknown) => String(a ?? "")) : null;
        if (!answers) return { quiz, needsAnswers: true as const };
      } else {
        answers = await simulateAnswers(submission, quiz, mode === "vague" ? "vague" : "knows_work");
      }
      const comprehension = await gradeAnswers({ assignmentText: submission, transcript, quiz, answers });
      const card = scoreSubmission({ quiz, submissionText: submission, transcript, comprehension });
      return { quiz, answers, comprehension, card, needsAnswers: false as const };
    });
    return NextResponse.json({ ...result, costUsd: tally.costUsd, calls: tally.calls, ms: Date.now() - started });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Analysis failed." }, { status: 502 });
  }
}
