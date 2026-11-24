import type Anthropic from "@anthropic-ai/sdk";
import { callClaude } from "./ai";


const SYSTEM_PROMPT = `You help a professor turn their course syllabus into a short list of concrete assignments they can post to students.

Read the syllabus text. Identify the actual graded assignments it describes (problem sets, short-answer questions, journals, essays, research papers, presentations, etc.) along with anything it says about format or requirements (word counts, number of sources, number of questions, etc.).

Produce 3 to 6 suggested assignments. For each one:
- "title": a short, specific name a teacher would actually use (e.g. "Essay 1: The Texas Revolution", "Weekly reading journal", "Research paper").
- "instructions": one to three sentences telling the student exactly what to do, in the professor's voice, including any concrete requirements the syllabus states (length, number of sources, number of questions, etc.). If the syllabus doesn't specify a requirement, don't invent one.

If the syllabus doesn't clearly describe any gradable assignments, suggest a small number of reasonable generic ones that fit the course's general subject and note that they're generic in the instructions.

Report your suggestions using the suggest_assignments tool. Don't write any other text.`;

export type AssignmentSuggestion = { title: string; instructions: string };

// Forced tool call rather than prompted "respond with JSON" text, so the API
// guarantees schema-valid output instead of relying on JSON.parse against
// freeform model text (which can break on an unescaped quote in the title
// or instructions).
const SUGGEST_TOOL: Anthropic.Tool = {
  name: "suggest_assignments",
  description: "Report the suggested assignments pulled from the syllabus.",
  input_schema: {
    type: "object",
    properties: {
      suggestions: {
        type: "array",
        minItems: 1,
        maxItems: 6,
        items: {
          type: "object",
          properties: {
            title: { type: "string" },
            instructions: { type: "string" },
          },
          required: ["title", "instructions"],
        },
      },
    },
    required: ["suggestions"],
  },
};

export async function generateAssignmentSuggestions(syllabusText: string): Promise<AssignmentSuggestion[]> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("Server is missing ANTHROPIC_API_KEY.");
  }

  const message = await callClaude("suggestions", {
    model: "claude-sonnet-5",
    max_tokens: 1536,
    system: SYSTEM_PROMPT,
    tools: [SUGGEST_TOOL],
    tool_choice: { type: "tool", name: "suggest_assignments" },
    messages: [{ role: "user", content: `SYLLABUS:\n${syllabusText}` }],
  });

  const toolUse = message.content.find((b) => b.type === "tool_use" && b.name === "suggest_assignments");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("Couldn't generate suggestions. Try again.");
  }

  const input = toolUse.input as { suggestions?: AssignmentSuggestion[] };
  return Array.isArray(input.suggestions) ? input.suggestions : [];
}
