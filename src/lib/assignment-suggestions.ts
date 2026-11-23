import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `You help a professor turn their course syllabus into a short list of concrete assignments they can post to students.

Read the syllabus text. Identify the actual graded assignments it describes (problem sets, short-answer questions, journals, essays, research papers, presentations, etc.) along with anything it says about format or requirements (word counts, number of sources, number of questions, etc.).

Produce 3 to 6 suggested assignments. For each one:
- "title": a short, specific name a teacher would actually use (e.g. "Essay 1: The Texas Revolution", "Weekly reading journal", "Research paper").
- "instructions": one to three sentences telling the student exactly what to do, in the professor's voice, including any concrete requirements the syllabus states (length, number of sources, number of questions, etc.). If the syllabus doesn't specify a requirement, don't invent one.

If the syllabus doesn't clearly describe any gradable assignments, suggest a small number of reasonable generic ones that fit the course's general subject and note that they're generic in the instructions.

Respond with ONLY valid JSON in this exact shape, no other text:

{
  "suggestions": [
    { "title": "...", "instructions": "..." }
  ]
}`;

export type AssignmentSuggestion = { title: string; instructions: string };

export async function generateAssignmentSuggestions(syllabusText: string): Promise<AssignmentSuggestion[]> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("Server is missing ANTHROPIC_API_KEY.");
  }

  const message = await anthropic.messages.create({
    model: "claude-sonnet-5",
    max_tokens: 1536,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: `SYLLABUS:\n${syllabusText}` }],
  });

  const textBlock = message.content.find((b) => b.type === "text");
  const raw = textBlock && "text" in textBlock ? textBlock.text : "";

  let parsed: { suggestions: AssignmentSuggestion[] };
  try {
    parsed = JSON.parse(raw);
  } catch {
    const stripped = raw.replace(/^```json\s*/i, "").replace(/```$/, "").trim();
    parsed = JSON.parse(stripped);
  }

  return Array.isArray(parsed.suggestions) ? parsed.suggestions : [];
}
