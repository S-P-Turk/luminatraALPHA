import type Anthropic from "@anthropic-ai/sdk";
import { callClaude, MODELS } from "./ai";
import { numberedParagraphs, splitParagraphs } from "./paragraphs";


// Kept identical in spirit to the original app/api/generate-quiz prototype
// prompt — pulled out here so the real student-submission flow and the
// /dev/quiz-test page can both generate a quiz the same way.
const SYSTEM_PROMPT = `You are part of an academic integrity tool. A student has submitted three things:
1. A transcript of their AI conversation(s) while working on an assignment.
2. The course syllabus, which states the professor's rules for AI use on this assignment.
3. The work they actually submitted (may be missing for older test calls).

Your job, in order:

1. Read the syllabus and extract the specific AI-use rules for this assignment (what's allowed, what's not, any disclosure requirements). If the syllabus doesn't address AI use clearly, say so.

2. Read the transcript and determine which parts of the assignment the student claims the AI helped with, and which parts they claim they did themselves (independent reasoning, writing, or sourcing).

3. (The comprehension quiz is written separately; don't write questions here.)

4. Only report a policy_concern if the transcript affirmatively shows the AI being used in a way the syllabus doesn't allow — for example, the syllabus bans AI drafting but the transcript shows the AI writing full sentences or paragraphs that plausibly ended up in the submission, or the syllabus requires disclosure and the transcript shows AI help the student didn't disclose elsewhere. Never flag a concern just because the transcript doesn't prove the student met some other requirement (number of sources, word count, formatting, etc.) — those aren't AI-use questions, they're separate grading matters outside what this tool checks, and "I can't verify this from the transcript" is not evidence of a violation. If you don't see a clear, transcript-evidenced AI-use violation, report policy_concern as an empty string.

5. Set policy_severity: "none" if there's no policy_concern; "minor" if the concern is borderline or small in scope (e.g. light AI rewording where the rule is ambiguous); "clear" if the transcript plainly shows AI use the syllabus forbids.

6. If the submitted work is provided, map where AI contributed to it. In ai_passages, list every passage of the submitted work that derives from an AI reply in the transcript. For each:
   - submission_excerpt: copied EXACTLY, character for character, from the submitted work (at least 8 words; split long passages into separate entries of up to ~60 words).
   - Don't copy the AI source text here: it goes once, in that paragraph's ai_source_excerpt (step 8), and is matched up automatically.
   - kind: "verbatim" if the AI's wording was copied as-is or with trivial edits (punctuation, a word or two); "paraphrased" if the passage clearly follows the AI reply's specific wording and structure but was reworded; "edited" if the student wrote the text first (it appears in the student's own message) and the AI only corrected or polished it.
   - claimed_as_own: true if the student presents that part as their own work or doesn't disclose the AI's role; false if they openly disclosed that AI wrote or helped write it.
   Only use the AI's replies as sources — never text the student typed into the chat. Don't include passages that merely share a topic, facts, or ideas with an AI reply; brainstormed ideas the student wrote up in their own words are the student's writing. If there are none, return an empty list. Excerpts are verified mechanically against the submission and transcript, so never paraphrase them.

7. usage_summary: one plain sentence (under 30 words) describing how the student used AI overall, e.g. "Used AI to brainstorm angles and check grammar; one paragraph was copied from an AI reply without disclosure." If the transcript shows no AI use, say "No AI use shown in the transcript."

8. Rate AI reliance for every numbered paragraph of the submitted work (if provided) in paragraphs — how much of that paragraph's substance came from the AI, counting ideas as well as wording:
   - "none": the student's own ideas and writing (AI may have fixed grammar or spelling only).
   - "ideas": the AI supplied the point (an idea, argument, example, or source), but the student expressed it in their own words and their own sentence structure — you could not match it to the AI reply phrase by phrase.
   - "heavy": the paragraph tracks an AI reply sentence by sentence, reusing most of its key terms and much of its phrasing, just reworded.
   - "written": the AI's sentences appear nearly word for word (copied, or only lightly edited).
   Cite the complete AI sentence(s) the paragraph draws on as ai_source_excerpt — the source is measured against the paragraph to confirm the level.
   For each, give index, reliance, disclosed (true only if the student openly said AI did this), a note (under 15 words, e.g. "Argument about hyperinflation comes from the AI's explanation."), and ai_source_excerpt: the AI reply text it came from, copied EXACTLY from the transcript (empty string for "none"). Only AI replies count as sources, never the student's own messages. A rating above "none" with no real source in the transcript is not allowed.

Keep everything short and plain — a busy teacher reads this in seconds. policy_summary is one sentence (under 20 words). policy_concern, when present, is one sentence (under 25 words) describing what in the transcript a teacher should follow up on and which rule it relates to. Never state a conclusion or accuse — the teacher decides; you only point to what is worth a closer look. No hedging, no restating the syllabus.

Report your findings using the submit_analysis tool. Don't write any other text.`;

// The comprehension quiz, written in its own call after the score is out, so
// students see their score without waiting for it.
const QUESTIONS_PROMPT = `You are part of an academic integrity tool. A student submitted work along with the transcript of their AI conversation(s), under the course syllabus's AI rules.

1. From the transcript, determine which parts of the assignment the student claims they did themselves (independent reasoning, writing, or sourcing). List them in claimed_unassisted_areas (short phrases).

2. Write exactly 2 quiz questions that test the student's understanding specifically of the parts they claim were NOT AI-assisted. Don't pick these at random — pick the two spots in the claimed-unassisted work that are most likely to expose a real gap: a specific fact, number, or reasoning step that would be hard to answer correctly unless the student actually did that work themselves. If an outside source is mentioned in the transcript as something the student found/used themselves, strongly prefer a question asking what that specific source actually argues over a generic content question — misrepresented sourcing is the easiest gap to catch. A student who actually did the claimed-unassisted work should be able to answer both quickly and specifically; a student who faked the transcript to hide AI use will struggle on at least one.
   - Both questions must be answerable correctly in one sentence each. Ask short, specific questions.
   - what_it_tests is a few words.

Report using the submit_questions tool. Don't write any other text.`;

export type AiPassage = {
  submission_excerpt: string;
  claimed_as_own: boolean;
  // Added with the contribution map; absent on older analyses.
  transcript_excerpt?: string;
  kind?: "verbatim" | "paraphrased" | "edited";
};

export type ParagraphReliance = {
  index: number;
  reliance: "none" | "ideas" | "heavy" | "written";
  disclosed: boolean;
  note: string;
  ai_source_excerpt: string;
};

export type QuizResult = {
  policy_summary: string;
  policy_concern: string | null;
  // Added with the scoring layer; absent on submissions analyzed before it.
  policy_severity?: "none" | "minor" | "clear";
  ai_passages?: AiPassage[];
  usage_summary?: string;
  // Added with AI reliance (scoring v3); absent on older analyses.
  paragraphs?: ParagraphReliance[];
  claimed_unassisted_areas: string[];
  quiz: { question: string; expected_length: "one_sentence" | "two_sentences"; what_it_tests: string }[];
};

// Structured as a forced tool call rather than "respond with JSON" prompted
// text — the API enforces schema-valid output this way. The earlier
// prompted-JSON version would occasionally break JSON.parse when the model's
// own text contained an unescaped quote or got cut off mid-string.
const ANALYSIS_TOOL: Anthropic.Tool = {
  name: "submit_analysis",
  description: "Report the policy analysis and AI reliance for this submission.",
  input_schema: {
    type: "object",
    properties: {
      policy_summary: {
        type: "string",
        description: "One sentence, under 20 words: what the syllabus allows/forbids for AI use.",
      },
      policy_concern: {
        type: "string",
        description: "One sentence, under 25 words, describing transcript-evidenced AI use worth a teacher follow-up and the rule it relates to (e.g. AI appears to draft text where the syllabus bans drafting). Neutral wording, no verdict. Empty string otherwise — never flag just because something can't be verified from the transcript, like source or word counts.",
      },
      policy_severity: { type: "string", enum: ["none", "minor", "clear"] },
      ai_passages: {
        type: "array",
        description: "Passages of the submitted work that derive from AI replies.",
        items: {
          type: "object",
          properties: {
            submission_excerpt: { type: "string" },
            kind: { type: "string", enum: ["verbatim", "paraphrased", "edited"] },
            claimed_as_own: { type: "boolean" },
          },
          required: ["submission_excerpt", "kind", "claimed_as_own"],
        },
      },
      usage_summary: { type: "string", description: "One plain sentence on how the student used AI overall." },
      paragraphs: {
        type: "array",
        description: "AI reliance for each numbered paragraph of the submitted work.",
        items: {
          type: "object",
          properties: {
            index: { type: "integer" },
            reliance: { type: "string", enum: ["none", "ideas", "heavy", "written"] },
            disclosed: { type: "boolean" },
            note: { type: "string" },
            ai_source_excerpt: { type: "string" },
          },
          required: ["index", "reliance", "disclosed", "note", "ai_source_excerpt"],
        },
      },
    },
    required: ["policy_summary", "policy_concern", "policy_severity", "ai_passages", "usage_summary", "paragraphs"],
  },
};

const QUESTIONS_TOOL: Anthropic.Tool = {
  name: "submit_questions",
  description: "Report the comprehension quiz for this submission.",
  input_schema: {
    type: "object",
    properties: {
      claimed_unassisted_areas: {
        type: "array",
        items: { type: "string" },
        description: "Short list of what the student claims they did without AI help.",
      },
      quiz: {
        type: "array",
        minItems: 2,
        maxItems: 2,
        items: {
          type: "object",
          properties: {
            question: { type: "string" },
            expected_length: { type: "string", enum: ["one_sentence", "two_sentences"] },
            what_it_tests: { type: "string", description: "A few words: the specific gap this question targets." },
          },
          required: ["question", "expected_length", "what_it_tests"],
        },
      },
    },
    required: ["claimed_unassisted_areas", "quiz"],
  },
};

const userContent = (transcript: string, syllabus: string, submissionText?: string) =>
  `SYLLABUS:\n${syllabus}\n\n---\n\nAI TRANSCRIPT:\n${transcript}` +
  (submissionText
    ? `\n\n---\n\nSUBMITTED WORK (paragraphs numbered for the reliance ratings; the numbers are not part of the text):\n${numberedParagraphs(submissionText)}`
    : "");

const norm = (t: string) => t.toLowerCase().replace(/\s+/g, " ").trim();

/**
 * Each AI passage's source text is written once, in its paragraph's
 * ai_source_excerpt, instead of twice. Fill it back in for the contribution map.
 */
export function fillPassageSources(analysis: QuizResult, submissionText?: string): QuizResult {
  if (!submissionText || !analysis.ai_passages?.length) return analysis;
  const paras = splitParagraphs(submissionText);
  const byIndex = new Map((analysis.paragraphs ?? []).map((p) => [p.index, p.ai_source_excerpt]));
  return {
    ...analysis,
    ai_passages: analysis.ai_passages.map((a) => {
      if (a.transcript_excerpt) return a;
      const ex = norm(a.submission_excerpt);
      const home = paras.find((p) => norm(p.text).includes(ex.slice(0, 80)));
      const src = home ? byIndex.get(home.index) : undefined;
      return src ? { ...a, transcript_excerpt: src } : a;
    }),
  };
}

/** Policy, AI reliance and passages: everything the score needs. No quiz. */
export async function analyzeSubmission(transcript: string, syllabus: string, submissionText?: string): Promise<QuizResult> {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("Server is missing ANTHROPIC_API_KEY.");
  const message = await callClaude("analysis", {
    model: MODELS.main,
    max_tokens: 3000,
    system: SYSTEM_PROMPT,
    tools: [ANALYSIS_TOOL],
    tool_choice: { type: "tool", name: "submit_analysis" },
    messages: [{ role: "user", content: userContent(transcript, syllabus, submissionText) }],
  });
  const toolUse = message.content.find((b) => b.type === "tool_use" && b.name === "submit_analysis");
  if (!toolUse || toolUse.type !== "tool_use") throw new Error("The analysis didn't return a structured result. Try again.");
  const analysis = { ...(toolUse.input as QuizResult), claimed_unassisted_areas: [], quiz: [] };
  return fillPassageSources(analysis, submissionText);
}

/** The two comprehension questions, written after the score is out. */
export async function writeQuizQuestions(
  transcript: string,
  syllabus: string,
  submissionText?: string
): Promise<Pick<QuizResult, "claimed_unassisted_areas" | "quiz">> {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("Server is missing ANTHROPIC_API_KEY.");
  const message = await callClaude("analysis", {
    model: MODELS.main,
    max_tokens: 800,
    system: QUESTIONS_PROMPT,
    tools: [QUESTIONS_TOOL],
    tool_choice: { type: "tool", name: "submit_questions" },
    messages: [{ role: "user", content: userContent(transcript, syllabus, submissionText) }],
  });
  const toolUse = message.content.find((b) => b.type === "tool_use" && b.name === "submit_questions");
  if (!toolUse || toolUse.type !== "tool_use") throw new Error("The quiz writer didn't return a structured result.");
  const r = toolUse.input as Pick<QuizResult, "claimed_unassisted_areas" | "quiz">;
  return { claimed_unassisted_areas: r.claimed_unassisted_areas ?? [], quiz: r.quiz ?? [] };
}

/** Both, in parallel. Used by the test set and the admin lab. */
export async function generateQuiz(transcript: string, syllabus: string, submissionText?: string): Promise<QuizResult> {
  const [analysis, questions] = await Promise.all([
    analyzeSubmission(transcript, syllabus, submissionText),
    writeQuizQuestions(transcript, syllabus, submissionText),
  ]);
  return { ...analysis, ...questions };
}

// ---------------------------------------------------------------------------
// Checking the student's quiz answers. Answers that don't clearly show
// understanding suggest a follow-up — a separate reason from an AI-use
// concern. It's never a verdict; the teacher reviews and decides.

export type ComprehensionResult = {
  passed: boolean;
  note: string;
  per_question: { adequate: boolean; reason: string }[];
};

const GRADE_SYSTEM_PROMPT = `You are part of an academic integrity tool. A student submitted an assignment and an AI-use transcript, then answered a short comprehension check about the parts of the work they claim they did WITHOUT AI help.

Decide, for each answer, whether it shows the student genuinely understands that part of their own submission. An answer is adequate if it is specific and consistent with the submitted work — it doesn't need to be polished or perfectly worded. An answer is NOT adequate if it is wrong, contradicts the submission, is vague or generic enough that anyone could write it without having done the work, dodges the question, or is blank / "I don't know" / nonsense.

Set passed to false if any answer is not adequate — this does NOT mean the student cheated, only that a teacher may want to follow up (e.g. a short conversation). Never accuse or draw conclusions about intent.

Keep it short and neutral: each reason is a few words; note is one sentence (under 25 words) a teacher can read at a glance, saying what is worth following up on (e.g. "Couldn't describe the source cited in paragraph 2 — worth asking about."). If all answers are adequate, note is a short confirmation.

Report using the submit_grade tool. Don't write any other text.`;

const GRADE_TOOL: Anthropic.Tool = {
  name: "submit_grade",
  description: "Report whether the student's quiz answers show real comprehension.",
  input_schema: {
    type: "object",
    properties: {
      passed: { type: "boolean" },
      note: { type: "string", description: "One sentence, under 25 words, for the teacher." },
      per_question: {
        type: "array",
        items: {
          type: "object",
          properties: {
            adequate: { type: "boolean" },
            reason: { type: "string", description: "A few words." },
          },
          required: ["adequate", "reason"],
        },
      },
    },
    required: ["passed", "note", "per_question"],
  },
};

export async function gradeAnswers(input: {
  assignmentText: string;
  transcript: string;
  quiz: QuizResult;
  answers: string[];
}): Promise<ComprehensionResult> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("Server is missing ANTHROPIC_API_KEY.");
  }

  const qa = input.quiz.quiz
    .map((q, i) => `Q${i + 1}: ${q.question}\n(tests: ${q.what_it_tests})\nA${i + 1}: ${input.answers[i] ?? ""}`)
    .join("\n\n");

  const message = await callClaude("grading", {
    model: MODELS.fast,
    max_tokens: 1024,
    system: GRADE_SYSTEM_PROMPT,
    tools: [GRADE_TOOL],
    tool_choice: { type: "tool", name: "submit_grade" },
    messages: [
      {
        role: "user",
        content: `STUDENT'S SUBMITTED WORK:\n${input.assignmentText}\n\n---\n\nAI TRANSCRIPT:\n${input.transcript}\n\n---\n\nWHAT THE STUDENT CLAIMS THEY DID WITHOUT AI:\n${input.quiz.claimed_unassisted_areas.join("; ")}\n\n---\n\nCOMPREHENSION CHECK:\n${qa}`,
      },
    ],
  });

  const toolUse = message.content.find((b) => b.type === "tool_use" && b.name === "submit_grade");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("The grader didn't return a structured result.");
  }
  return toolUse.input as ComprehensionResult;
}
