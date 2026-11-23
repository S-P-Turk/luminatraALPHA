import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Kept identical in spirit to the original app/api/generate-quiz prototype
// prompt — pulled out here so the real student-submission flow and the
// /dev/quiz-test page can both generate a quiz the same way.
const SYSTEM_PROMPT = `You are part of an academic integrity tool. A student has submitted two things:
1. A transcript of their AI conversation(s) while working on an assignment.
2. The course syllabus, which states the professor's rules for AI use on this assignment.

Your job, in order:

1. Read the syllabus and extract the specific AI-use rules for this assignment (what's allowed, what's not, any disclosure requirements). If the syllabus doesn't address AI use clearly, say so.

2. Read the transcript and determine which parts of the assignment the student claims the AI helped with, and which parts they claim they did themselves (independent reasoning, writing, or sourcing).

3. Generate exactly 2 quiz questions that test the student's understanding specifically of the parts they claim were NOT AI-assisted. Don't pick these at random — pick the two spots in the claimed-unassisted work that are most likely to expose a real gap: a specific fact, number, or reasoning step that would be hard to answer correctly unless the student actually did that work themselves. If an outside source is mentioned in the transcript as something the student found/used themselves, strongly prefer a question asking what that specific source actually argues over a generic content question — misrepresented sourcing is the easiest gap to catch. A student who actually did the claimed-unassisted work should be able to answer both quickly and specifically; a student who faked the transcript to hide AI use will struggle on at least one.
   - Question 1 must be answerable correctly in one sentence.
   - Question 2 must be answerable correctly in two sentences.

4. Note any apparent mismatch between the syllabus rules and what the transcript shows the student doing (for example, the syllabus bans AI drafting but the transcript shows the AI writing full paragraphs).

Respond with ONLY valid JSON in this exact shape, no other text:

{
  "policy_summary": "plain-language summary of what the syllabus allows/requires for AI use",
  "policy_concern": "null, or a short note on any mismatch between stated policy and what the transcript shows",
  "claimed_unassisted_areas": ["short list of what the student claims they did without AI help"],
  "quiz": [
    { "question": "...", "expected_length": "one_sentence", "what_it_tests": "short note on the specific gap this targets" },
    { "question": "...", "expected_length": "two_sentences", "what_it_tests": "short note on the specific gap this targets" }
  ]
}`;

export type QuizResult = {
  policy_summary: string;
  policy_concern: string | null;
  claimed_unassisted_areas: string[];
  quiz: { question: string; expected_length: "one_sentence" | "two_sentences"; what_it_tests: string }[];
};

export async function generateQuiz(transcript: string, syllabus: string): Promise<QuizResult> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("Server is missing ANTHROPIC_API_KEY.");
  }

  const message = await anthropic.messages.create({
    model: "claude-sonnet-5",
    max_tokens: 2048,
    system: SYSTEM_PROMPT,
    messages: [
      { role: "user", content: `SYLLABUS:\n${syllabus}\n\n---\n\nAI TRANSCRIPT:\n${transcript}` },
    ],
  });

  const textBlock = message.content.find((b) => b.type === "text");
  const raw = textBlock && "text" in textBlock ? textBlock.text : "";

  try {
    return JSON.parse(raw) as QuizResult;
  } catch {
    const stripped = raw.replace(/^```json\s*/i, "").replace(/```$/, "").trim();
    return JSON.parse(stripped) as QuizResult;
  }
}
