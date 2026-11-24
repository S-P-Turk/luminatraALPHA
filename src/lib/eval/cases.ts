// Luminatra evaluation set: 3 course policies x 12 student scenarios = 36
// synthetic cases with the outcome a reasonable integrity officer would
// expect. "either" marks genuinely borderline cases that aren't scored.
// expectReliance is the answer key for the AI reliance label: the highest
// level any paragraph should get (undefined = not graded for that case).

export type Expect = "review" | "no_review" | "either";

export type EvalCase = {
  id: string;
  course: string;
  scenario: string;
  syllabus: string;
  instructions: string;
  submission: string;
  transcript: string;
  // How the simulated student answers the comprehension quiz.
  student: "knows_work" | "vague";
  expect: Expect;
  expectReliance?: "none" | "ideas" | "heavy" | "written";
  why: string;
};

type Course = {
  key: string;
  name: string;
  syllabus: string;
  instructions: string;
  ownParagraph: string; // written by the student
  ownDraftRough: string; // student's rough draft of ownParagraph
  aiParagraph: string; // what the AI wrote when asked to draft
  aiIdeas: string; // AI brainstorm reply
  aiFeedback: string; // AI comments on a draft (no rewritten prose)
  aiRephrase: { before: string; after: string }; // one sentence lightly reworded
  source: string;
  aiSourceSummary: string;
  aiArgument: string; // AI reply offering a distinctive argument
  ideaParagraph: string; // student's own words, built on that argument
  aiExplain: string; // AI reply explaining something in detail
  heavyParagraph: string; // close paraphrase of aiExplain
  draftRequest: string;
};

const courses: Course[] = [
  {
    key: "hist",
    name: "HIST 101 (strict: no AI-written sentences)",
    syllabus:
      "AI policy: You may use AI tools to brainstorm topics and to check grammar. AI may not write any sentence that appears in your essay. Disclose all AI use in a short statement at the end.",
    instructions: "Essay 1: In 300 words, argue whether the Treaty of Versailles made a second world war more likely.",
    ownParagraph:
      "My grandfather's stories about inflation made me curious, so I read Keynes's The Economic Consequences of the Peace. Keynes argued the reparations were impossible to pay, and that the bitterness this created gave extremists an easy story to tell voters.",
    ownDraftRough:
      "my grandpa told me about inflation, I read keynes economic consequences of the peace, he says reparations couldnt be paid and that made people bitter and extremists used it",
    aiParagraph:
      "The Treaty of Versailles imposed punitive reparations that destabilized the Weimar economy, deepening public resentment and creating fertile ground for nationalist movements that promised to restore German pride.",
    aiIdeas: "Possible angles: economic reparations, the war-guilt clause, territorial losses, or the weakness of the League of Nations.",
    aiFeedback: "Your second sentence is a run-on; consider splitting it. Also capitalize 'Keynes' and add the book title in italics.",
    aiRephrase: {
      before: "The treaty made a lot of Germans angry at the government.",
      after: "The treaty left many Germans deeply resentful of their government.",
    },
    source: "Keynes, The Economic Consequences of the Peace (1919)",
    aiSourceSummary:
      "Keynes argued that the reparations demanded of Germany were economically unpayable and would impoverish Central Europe, sowing the seeds of future conflict.",
    draftRequest: "Write me a paragraph about how the Treaty of Versailles caused WWII.",
    aiArgument:
      "One overlooked factor is the 'stab-in-the-back' myth: because the treaty was signed by civilian politicians, nationalists could blame the Weimar Republic rather than the army for Germany's defeat.",
    ideaParagraph:
      "What stood out to me is that the treaty let nationalists shift the blame. Since civilians signed it, people could pretend the army never really lost, and that lie made the republic look like traitors.",
    aiExplain:
      "The war-guilt clause, Article 231, forced Germany to accept sole responsibility for the war, which became a symbol of national humiliation and a rallying point for revisionist politics throughout the 1920s.",
    heavyParagraph:
      "Article 231, the war-guilt clause, made Germany accept full responsibility for the war, and it turned into a symbol of humiliation and a rallying point for revisionist politics during the 1920s.",
  },
  {
    key: "bio",
    name: "BIO 210 (permissive: AI drafting allowed with disclosure)",
    syllabus:
      "AI policy: AI tools may be used for any part of this lab report, including drafting text, as long as your AI-use statement identifies which parts were written by AI.",
    instructions: "Lab report 2: Explain how temperature affected catalase activity in your experiment.",
    ownParagraph:
      "At 37 degrees our catalase produced the most foam, about 4.2 cm, while at 70 degrees it produced almost none. I think the high temperature denatured the enzyme so its active site no longer fit hydrogen peroxide.",
    ownDraftRough:
      "37 deg most foam 4.2cm, 70 deg almost none, prob denatured enzyme so active site doesnt fit h2o2 anymore",
    aiParagraph:
      "Catalase activity peaked near physiological temperature because molecular collisions increased with heat, but beyond the optimum the enzyme's tertiary structure unfolded, irreversibly reducing its catalytic efficiency.",
    aiIdeas: "You could discuss the optimum temperature, denaturation, collision frequency, and possible sources of measurement error.",
    aiFeedback: "Good data. Add units to every measurement and state your hypothesis before the results.",
    aiRephrase: {
      before: "The foam went down a lot when it got really hot.",
      after: "Foam production dropped sharply at high temperatures.",
    },
    source: "Campbell Biology, chapter 8 on enzymes",
    aiSourceSummary:
      "Campbell explains that each enzyme has an optimal temperature, above which hydrogen bonds in its structure break and the protein denatures, losing function.",
    draftRequest: "Write the discussion paragraph for my catalase temperature lab.",
    aiArgument:
      "One way to explain the drop at low temperatures is that molecules move more slowly, so enzyme and substrate collide less often, which lowers the reaction rate without damaging the enzyme.",
    ideaParagraph:
      "At 10 degrees the foam was much lower too, but I don't think the enzyme was damaged. It's more that everything was moving slower in the cold, so the catalase met the peroxide less often.",
    aiExplain:
      "Above its optimum, catalase loses activity because heat disrupts the hydrogen bonds holding its tertiary structure together, changing the shape of the active site so hydrogen peroxide can no longer bind.",
    heavyParagraph:
      "Past its optimum, catalase loses activity since heat disrupts the hydrogen bonds that hold its tertiary structure together, which changes the active site's shape so hydrogen peroxide can no longer bind.",
  },
  {
    key: "phil",
    name: "PHIL 120 (no AI at all)",
    syllabus: "AI policy: No use of AI tools of any kind is permitted on this assignment, including brainstorming and grammar checking.",
    instructions: "Response paper: Is lying to a murderer at the door wrong under Kant's categorical imperative?",
    ownParagraph:
      "Kant says yes, because if everyone lied whenever it seemed helpful, nobody could trust promises and lying itself would stop working. I disagree, since the murderer has already given up the trust that the rule is meant to protect.",
    ownDraftRough:
      "kant says lying always wrong bc universal lying makes trust impossible. but murderer already broke trust so maybe exception?",
    aiParagraph:
      "Under the formula of universal law, a maxim permitting deception cannot be universalized without contradiction, since universal lying would destroy the very institution of trust on which deception depends.",
    aiIdeas: "You might compare the universal law formulation with the humanity formulation, or discuss Benjamin Constant's objection.",
    aiFeedback: "Your thesis is clear. Consider responding to an objection in your second paragraph.",
    aiRephrase: {
      before: "Kant would say you still can't lie even then.",
      after: "Kant would maintain that lying remains impermissible even then.",
    },
    source: "Kant, On a Supposed Right to Lie from Philanthropy (1797)",
    aiSourceSummary:
      "Kant argues that truthfulness is an unconditional duty, so one may not lie even to a murderer asking where a friend is hiding.",
    draftRequest: "Write a paragraph explaining Kant's view on lying to the murderer at the door.",
    aiArgument:
      "A useful distinction is between lying and refusing to answer: Kant's view may permit staying silent or deflecting, since the duty is not to assert falsehoods, not a duty to disclose everything.",
    ideaParagraph:
      "Maybe the answer is that I don't have to lie or tell the truth, I can just refuse to say anything. Kant only says I can't state something false, not that I owe the murderer information.",
    aiExplain:
      "Kant's critics, most famously Benjamin Constant, argued that the duty to tell the truth applies only to those who have a right to the truth, and a murderer seeking a victim has forfeited that right.",
    heavyParagraph:
      "Kant's critics, most famously Benjamin Constant, said the duty to tell the truth only applies to people who have a right to the truth, and a murderer looking for a victim has forfeited that right.",
  },
];

const NO_AI = "I did not use AI for this assignment.";

function build(c: Course): EvalCase[] {
  const strict = c.key === "hist";
  const permissive = c.key === "bio";
  const noAI = c.key === "phil";
  const mk = (
    n: number,
    scenario: string,
    submission: string,
    transcript: string,
    student: EvalCase["student"],
    expect: Expect,
    why: string,
    expectReliance?: EvalCase["expectReliance"]
  ): EvalCase => ({
    id: `${c.key}-${String(n).padStart(2, "0")}`,
    course: c.name,
    scenario,
    syllabus: c.syllabus,
    instructions: c.instructions,
    submission,
    transcript,
    student,
    expect,
    why,
    expectReliance,
  });

  return [
    mk(1, "No AI, honest", c.ownParagraph, NO_AI, "knows_work", "no_review", "Nothing to follow up on.", "none"),
    mk(
      2,
      "AI brainstorm only, disclosed",
      `${c.ownParagraph}\n\nAI statement: I used AI only to brainstorm angles.`,
      `User: Give me some angles for this assignment.\nAssistant: ${c.aiIdeas}`,
      "knows_work",
      noAI ? "review" : "no_review",
      noAI ? "Syllabus bans all AI, including brainstorming." : "Brainstorming is allowed and disclosed.",
      "none"
    ),
    mk(
      3,
      "AI grammar check on own draft",
      `${c.ownParagraph}\n\nAI statement: I used AI to check grammar.`,
      `User: Check the grammar in my draft: ${c.ownDraftRough}\nAssistant: ${c.aiFeedback}`,
      "knows_work",
      noAI ? "review" : "no_review",
      noAI ? "Syllabus bans grammar checking too." : "Grammar help is allowed; student's own words.",
      "none"
    ),
    mk(
      4,
      "AI-drafted paragraph pasted, not disclosed, student understands it",
      `${c.ownParagraph}\n\n${c.aiParagraph}`,
      `User: ${c.draftRequest}\nAssistant: ${c.aiParagraph}`,
      "knows_work",
      "review",
      "Undisclosed AI-written text in the submission.",
      "written"
    ),
    mk(
      5,
      "AI-drafted paragraph pasted, disclosed",
      `${c.ownParagraph}\n\n${c.aiParagraph}\n\nAI statement: The second paragraph was written by AI.`,
      `User: ${c.draftRequest}\nAssistant: ${c.aiParagraph}`,
      "knows_work",
      permissive ? "no_review" : "review",
      permissive ? "Drafting allowed with disclosure, and it was disclosed." : "Syllabus forbids AI-written sentences even if disclosed.",
      "written"
    ),
    mk(
      6,
      "AI-drafted paragraph pasted, not disclosed, student can't explain",
      `${c.ownParagraph}\n\n${c.aiParagraph}`,
      `User: ${c.draftRequest}\nAssistant: ${c.aiParagraph}`,
      "vague",
      "review",
      "Undisclosed AI text and weak comprehension.",
      "written"
    ),
    mk(
      7,
      "Own draft pasted for feedback; AI gave comments only",
      `${c.ownParagraph}${strict || permissive ? "\n\nAI statement: I asked AI for feedback on my draft." : ""}`,
      `User: Here's my draft, any feedback? ${c.ownParagraph}\nAssistant: ${c.aiFeedback}`,
      "knows_work",
      noAI ? "review" : "no_review",
      noAI
        ? "Any AI use breaks the no-AI rule."
        : "Text in both transcript and submission is the student's own; must not count as AI text.",
      "none"
    ),
    mk(
      8,
      "AI summarized the source; student claims they read it, answers vaguely",
      `${c.ownParagraph} I read ${c.source} myself for this.`,
      `User: Summarize ${c.source} for me.\nAssistant: ${c.aiSourceSummary}\nUser: thanks, I'll say I read it myself`,
      "vague",
      "review",
      "Claims to have read a source the AI summarized; can't explain it."
    ),
    mk(
      9,
      "No AI, honest work, but student answers the quiz vaguely",
      c.ownParagraph,
      NO_AI,
      "vague",
      "review",
      "By design: weak answers on both questions reach review (comprehension maxed). Known false-positive class — teacher clears.",
      "none"
    ),
    mk(
      10,
      "AI lightly reworded one sentence, not disclosed",
      `${c.ownParagraph} ${c.aiRephrase.after}`,
      `User: Make this sound better: ${c.aiRephrase.before}\nAssistant: ${c.aiRephrase.after}`,
      "knows_work",
      noAI ? "review" : "either",
      noAI ? "Any AI use breaks the no-AI rule." : "Borderline: one sentence of light rewording."
    ),
    mk(
      11,
      "Built on an AI's idea, in the student's own words, not disclosed",
      `${c.ownParagraph}\n\n${c.ideaParagraph}`,
      `User: What's an angle most people miss on this?\nAssistant: ${c.aiArgument}`,
      "knows_work",
      noAI ? "review" : "either",
      noAI
        ? "Any AI use breaks the no-AI rule."
        : "Borderline: idea-level help, own writing, but not disclosed. Reliance should read 'ideas'.",
      "ideas"
    ),
    mk(
      12,
      "AI explanation closely paraphrased, not disclosed",
      `${c.ownParagraph}\n\n${c.heavyParagraph}`,
      `User: Explain this part for me.\nAssistant: ${c.aiExplain}`,
      "knows_work",
      "review",
      "A paragraph that closely reworks an AI reply, presented as the student's own.",
      "heavy"
    ),
  ];
}

export const CASES: EvalCase[] = courses.flatMap(build);
