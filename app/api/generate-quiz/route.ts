import { NextRequest, NextResponse } from "next/server";
import { generateQuiz } from "@/src/lib/quiz";

// Dev-only passthrough to the real quiz-generation logic in src/lib/quiz.ts
// (used by /dev/quiz-test), kept as a thin wrapper so this and the real
// student-submission flow can never drift apart again.
export async function POST(req: NextRequest) {
  try {
    const { transcript, syllabus } = await req.json();

    if (!transcript || !syllabus) {
      return NextResponse.json(
        { error: "Both transcript and syllabus are required." },
        { status: 400 }
      );
    }

    const result = await generateQuiz(transcript, syllabus);
    return NextResponse.json({ result });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
