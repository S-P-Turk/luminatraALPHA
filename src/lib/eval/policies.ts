// Syllabus library for testing how Luminatra reads AI policies.
//
// Each entry pairs a course AI policy with one assignment and labels what the
// policy says about six common uses of AI. "unclear" means the policy doesn't
// settle it: the rules card should list it as a gap for the teacher, and the
// analyzer shouldn't treat that use as a clear violation.
//
// origin "synthetic": written for Luminatra to mirror the patterns seen in
// published policies (tiers, tool-specific rules, assignment exceptions,
// vague wording, contradictions). Real policies imported with
// scripts/import-policies.ts get origin "imported" plus a source.

export type Stance = "allowed" | "with_disclosure" | "not_allowed" | "unclear";
export type Use = "brainstorm" | "grammar" | "paraphrase" | "draft" | "research" | "code";
export type Tier = "prohibited" | "limited" | "disclosure" | "open" | "mixed";

export type PolicyCase = {
  id: string;
  discipline: string;
  level: "intro" | "upper" | "grad";
  tier: Tier;
  course: string;
  policy: string;
  assignment: { title: string; instructions: string };
  expected: Partial<Record<Use, Stance>>; // uses that don't apply are left out
  // Other readings that are defensible for a genuinely ambiguous policy, each
  // with the reason. Clear-cut uses never get one. Scored as "defensible",
  // reported separately from exact matches.
  alsoOk?: Partial<Record<Use, { stances: Stance[]; why: string }>>;
  quirk?: string; // what makes this one hard to read
  origin: "synthetic" | "imported";
  source?: string;
};

export const POLICY_CASES: PolicyCase[] = [
  {
    id: "pol-hist-ban",
    discipline: "History",
    level: "intro",
    tier: "prohibited",
    course: "HIST 101 World History since 1500",
    policy:
      "Generative AI tools (ChatGPT, Claude, Gemini, Copilot, and similar) may not be used at any stage of work in this course, including brainstorming, outlining, research, or editing. Spell-check and the grammar suggestions built into your word processor are fine. Use of generative AI will be treated as a violation of the academic integrity policy.",
    assignment: { title: "Primary source analysis", instructions: "In 600 words, analyze one primary source from the Atlantic slave trade unit. Identify the author, audience, and purpose, and explain what the source reveals and conceals." },
    expected: { brainstorm: "not_allowed", grammar: "not_allowed", paraphrase: "not_allowed", draft: "not_allowed", research: "not_allowed" },
    quirk: "Word-processor grammar tools are allowed but AI grammar help is not; the line between them is a common student question.",
    origin: "synthetic",
  },
  {
    id: "pol-eng-limited",
    discipline: "English / Writing",
    level: "intro",
    tier: "limited",
    course: "WRIT 150 Writing and Critical Reasoning",
    policy:
      "You may use AI to brainstorm topics, generate counterarguments to test your thesis, and get feedback on a draft you wrote. You may not submit any sentence that an AI wrote or rewrote. Every assignment must end with an AI Use Statement describing what you used, for what, and what you changed as a result. If you used no AI, say so.",
    assignment: { title: "Argumentative essay", instructions: "Write a 1,200-word argumentative essay on a local policy issue. Include at least four credible sources and address one counterargument." },
    expected: { brainstorm: "with_disclosure", grammar: "with_disclosure", paraphrase: "not_allowed", draft: "not_allowed", research: "unclear" },
    quirk: "Feedback on a draft is allowed but AI rewording is not; using AI to find sources isn't mentioned.",
    origin: "synthetic",
  },
  {
    id: "pol-cs-open",
    discipline: "Computer Science",
    level: "upper",
    tier: "open",
    course: "CSCI 310 Software Engineering",
    policy:
      "You are encouraged to use AI coding assistants (Copilot, ChatGPT, Claude, Cursor) on all programming assignments, as you would in industry. You are responsible for every line you submit: you must be able to explain any part of your code in a code review. Cite AI help in your commit messages with the tag [ai-assisted]. Written reflections must be your own words.",
    assignment: { title: "Sprint 2 feature + reflection", instructions: "Implement the search feature from the backlog with tests, then write a 300-word reflection on a design decision you made and what you would change." },
    expected: { brainstorm: "allowed", code: "with_disclosure", grammar: "unclear", paraphrase: "not_allowed", draft: "not_allowed", research: "allowed" },
    quirk: "Code is open with disclosure but the written reflection in the same assignment must be the student's own words.",
    origin: "synthetic",
  },
  {
    id: "pol-cs-intro-ban-code",
    discipline: "Computer Science",
    level: "intro",
    tier: "limited",
    course: "CSCI 103 Introduction to Programming",
    policy:
      "This course teaches you to write code yourself, so AI tools may not write, complete, or fix code for any graded assignment. You may ask an AI to explain a concept or an error message in general terms, as long as you do not paste your assignment code into it. Autocomplete features (like Copilot) must be turned off.",
    assignment: { title: "Lab 6: Linked lists", instructions: "Implement a singly linked list with insert, delete, and reverse. Submit your .cpp file and a short README explaining your reverse algorithm." },
    expected: { research: "allowed", code: "not_allowed", brainstorm: "unclear", draft: "unclear", grammar: "unclear", paraphrase: "unclear" },
    quirk: "Explaining concepts is allowed only if the student doesn't paste assignment code; the README isn't covered at all.",
    origin: "synthetic",
  },
  {
    id: "pol-bio-disclosure",
    discipline: "Biology",
    level: "upper",
    tier: "disclosure",
    course: "BISC 320 Molecular Biology",
    policy:
      "AI tools may be used for any part of your lab reports, including drafting, provided you (1) disclose which tool you used and how in the Methods section, and (2) verify every factual claim and citation against the primary literature. Fabricated or unverified citations will be treated as academic misconduct regardless of their source.",
    assignment: { title: "Lab report: CRISPR knockout", instructions: "Write a full lab report on the CRISPR knockout experiment: introduction, methods, results with figures, and discussion citing at least five primary papers." },
    expected: { brainstorm: "with_disclosure", grammar: "with_disclosure", paraphrase: "with_disclosure", draft: "with_disclosure", research: "with_disclosure" },
    quirk: "Disclosure goes in the Methods section, not at the end; AI-invented citations are the violation, not AI use.",
    origin: "synthetic",
  },
  {
    id: "pol-chem-vague",
    discipline: "Chemistry",
    level: "intro",
    tier: "mixed",
    course: "CHEM 105 General Chemistry",
    policy: "Please use AI tools responsibly and in a way that supports your learning. Academic integrity applies to all coursework.",
    assignment: { title: "Problem set 4: Stoichiometry", instructions: "Solve problems 1–12. Show all work and units. Problem 12 asks you to explain your reasoning in two or three sentences." },
    expected: { brainstorm: "unclear", grammar: "unclear", paraphrase: "unclear", draft: "unclear", research: "unclear" },
    quirk: "Says nothing concrete. Every use should come back as a gap, and no use should be treated as a clear violation.",
    origin: "synthetic",
  },
  {
    id: "pol-math-check-only",
    discipline: "Mathematics",
    level: "upper",
    tier: "limited",
    course: "MATH 425 Real Analysis",
    policy:
      "You may use AI to check a final numerical answer or to look up the statement of a theorem. You may not use AI to produce or outline a proof, to suggest the key step, or to rewrite your proof. Collaboration with classmates is allowed on ideas only; write-ups must be individual.",
    assignment: { title: "Homework 7", instructions: "Prove the five statements on uniform convergence. Write complete proofs in LaTeX." },
    expected: { research: "allowed", brainstorm: "not_allowed", draft: "not_allowed", paraphrase: "not_allowed", grammar: "unclear" },
    quirk: "Looking up a theorem is allowed but suggesting the key step is not; this is a fine line in a transcript.",
    origin: "synthetic",
  },
  {
    id: "pol-span-translation",
    discipline: "Foreign Languages",
    level: "intro",
    tier: "prohibited",
    course: "SPAN 150 Intermediate Spanish",
    policy:
      "Machine translation (Google Translate, DeepL) and generative AI may not be used to produce or correct any text you submit in Spanish. You may use a print or online dictionary for individual words. Writing that is beyond the level we have practiced in class will be discussed with you.",
    assignment: { title: "Composición 3", instructions: "Escribe 250 palabras sobre un recuerdo de tu infancia usando el pretérito y el imperfecto." },
    expected: { draft: "not_allowed", grammar: "not_allowed", paraphrase: "not_allowed", research: "unclear", brainstorm: "unclear" },
    quirk: "Dictionaries for single words are fine; translation tools count as AI here. Assignment is in Spanish.",
    origin: "synthetic",
  },
  {
    id: "pol-art-no-image",
    discipline: "Studio Art",
    level: "upper",
    tier: "limited",
    course: "FA 302 Digital Illustration",
    policy:
      "Image generators (Midjourney, DALL·E, Firefly generative fill) may not be used to create any part of a submitted artwork. You may use text-based AI to research art history or brainstorm themes, and you must list it in your artist statement. AI-generated reference images are allowed for sketching only if you show them in your process folder.",
    assignment: { title: "Editorial illustration + artist statement", instructions: "Create an editorial illustration for a provided article and write a 200-word artist statement explaining your choices." },
    expected: { brainstorm: "with_disclosure", research: "with_disclosure", draft: "unclear", grammar: "unclear", paraphrase: "unclear" },
    quirk: "Rules are about images; whether AI can help write the artist statement isn't addressed.",
    origin: "synthetic",
  },
  {
    id: "pol-nurs-privacy",
    discipline: "Nursing",
    level: "upper",
    tier: "disclosure",
    course: "NURS 340 Adult Health",
    policy:
      "You may use AI to study, to brainstorm, and to improve the clarity of your writing, with a disclosure at the end of the assignment. Never enter any patient information, even de-identified, into an AI tool; doing so is a HIPAA and professionalism violation. Care plans must reflect your own clinical reasoning.",
    assignment: { title: "Care plan", instructions: "Write a nursing care plan for your assigned clinical patient with three prioritized diagnoses, outcomes, and evidence-based interventions." },
    expected: { brainstorm: "with_disclosure", grammar: "with_disclosure", paraphrase: "with_disclosure", draft: "not_allowed", research: "with_disclosure" },
    quirk: "A privacy rule (no patient data in AI) sits on top of the AI-use rule; pasting clinical details is the bigger violation.",
    origin: "synthetic",
  },
  {
    id: "pol-law-citations",
    discipline: "Law",
    level: "grad",
    tier: "disclosure",
    course: "LAW 605 Legal Research and Writing",
    policy:
      "AI tools may be used for research and drafting of the memo, consistent with emerging professional norms, provided you disclose the tool and use in a footnote and independently verify every authority cited in Westlaw or Lexis. Citing a nonexistent or mischaracterized case is a serious violation regardless of how it occurred. The closed-universe exam memo must be completed without AI.",
    assignment: { title: "Open research memo", instructions: "Draft an objective office memorandum analyzing whether the client has a viable claim for promissory estoppel under California law." },
    expected: { brainstorm: "with_disclosure", grammar: "with_disclosure", paraphrase: "with_disclosure", draft: "with_disclosure", research: "with_disclosure" },
    quirk: "Open for this memo but banned for a different assignment in the same course.",
    origin: "synthetic",
  },
  {
    id: "pol-psyc-stats",
    discipline: "Psychology",
    level: "intro",
    tier: "limited",
    course: "PSYC 274 Statistics",
    policy:
      "You may use AI to explain statistical concepts or to help debug R code, but the analysis decisions and interpretation in your write-up must be your own. Do not ask an AI to interpret your output. Note any AI help in a comment at the top of your R script.",
    assignment: { title: "Data project", instructions: "Run an appropriate test on the provided survey dataset, report the result in APA style, and interpret it in one paragraph." },
    expected: { research: "with_disclosure", code: "with_disclosure", draft: "not_allowed", paraphrase: "unclear", brainstorm: "unclear", grammar: "unclear" },
    quirk: "Disclosure goes in the R script, not the write-up.",
    origin: "synthetic",
  },
  {
    id: "pol-bus-encouraged",
    discipline: "Business",
    level: "upper",
    tier: "open",
    course: "MKT 402 Marketing Strategy",
    policy:
      "Use AI as much as you find helpful: for research, idea generation, drafting, slides, and editing. Marketing professionals use these tools daily and so should you. No disclosure is required. You will be graded on the quality of your strategy and your ability to defend it in the live presentation.",
    assignment: { title: "Go-to-market plan", instructions: "Build a go-to-market plan for a product launch: market analysis, positioning, channels, budget, and a 10-slide deck." },
    expected: { brainstorm: "allowed", grammar: "allowed", paraphrase: "allowed", draft: "allowed", research: "allowed" },
    quirk: "Fully open with no disclosure; nothing in a transcript should raise the rules signal.",
    origin: "synthetic",
  },
  {
    id: "pol-phil-contradict",
    discipline: "Philosophy",
    level: "upper",
    tier: "mixed",
    course: "PHIL 340 Ethics",
    policy:
      "Course policy: no generative AI on written work.\n\nAssignment note (Paper 2 only): For this paper, you will have an AI argue against your thesis and respond to it. Include the full AI exchange as an appendix.",
    assignment: { title: "Paper 2: Arguing with a machine", instructions: "Defend a position on moral luck in 1,500 words. Use an AI to generate the strongest objection, quote it, and respond." },
    expected: { brainstorm: "with_disclosure", draft: "not_allowed", paraphrase: "not_allowed", grammar: "not_allowed", research: "unclear" },
    quirk: "Course-level ban with an assignment-level exception; the exception should win for its narrow use only.",
    origin: "synthetic",
  },
  {
    id: "pol-poli-cite-format",
    discipline: "Political Science",
    level: "intro",
    tier: "disclosure",
    course: "POSC 110 Ideology and Conflict",
    policy:
      "You may use AI for brainstorming, outlining, and feedback. If any AI-generated wording appears in your paper, put it in quotation marks and cite it in Chicago style with the tool, date, and prompt. Unquoted AI wording counts as plagiarism.",
    assignment: { title: "Response paper", instructions: "In 800 words, compare how two thinkers from the unit explain the origins of political conflict." },
    expected: { brainstorm: "allowed", grammar: "unclear", paraphrase: "not_allowed", draft: "with_disclosure", research: "unclear" },
    quirk: "AI wording is allowed only as a quoted, cited source; paraphrasing AI without quotes is the violation.",
    origin: "synthetic",
  },
  {
    id: "pol-econ-tools",
    discipline: "Economics",
    level: "upper",
    tier: "limited",
    course: "ECON 351 Econometrics",
    policy:
      "Grammarly and similar grammar tools are allowed without disclosure. ChatGPT and other chatbots are allowed only for coding help in Stata or R and must be acknowledged in your do-file. They may not be used for the written interpretation of results.",
    assignment: { title: "Replication project", instructions: "Replicate the main table of the assigned paper, then write a 1,000-word discussion of the identification strategy and its weaknesses." },
    expected: { grammar: "allowed", code: "with_disclosure", draft: "not_allowed", paraphrase: "unclear", brainstorm: "unclear", research: "unclear" },
    quirk: "Grammarly allowed silently; does Grammarly's own generative rewrite count? Policy doesn't say.",
    origin: "synthetic",
  },
  {
    id: "pol-eng-mech-lab",
    discipline: "Mechanical Engineering",
    level: "upper",
    tier: "disclosure",
    course: "AME 341 Mechoptronics Lab",
    policy:
      "AI may be used to help write lab reports and analysis code. Disclose the tool and what it was used for in an appendix. You must take and report your own measurements; AI may never be used to generate, fill in, or smooth data.",
    assignment: { title: "Lab 3 report: PID control", instructions: "Report your PID tuning experiment with step-response plots, measured overshoot and settling time, and a comparison to the model." },
    expected: { brainstorm: "with_disclosure", grammar: "with_disclosure", paraphrase: "with_disclosure", draft: "with_disclosure", code: "with_disclosure", research: "with_disclosure" },
    quirk: "Writing is open with disclosure; fabricating data is the line.",
    origin: "synthetic",
  },
  {
    id: "pol-jour-sourcing",
    discipline: "Journalism",
    level: "upper",
    tier: "limited",
    course: "JOUR 320 News Reporting",
    policy:
      "Stories must be reported and written by you. AI may be used to transcribe your own interviews and to check AP style. It may not be used to write ledes, paragraphs, or headlines, or to find or summarize sources. Fabricating a quote is grounds for failing the course.",
    assignment: { title: "Profile story", instructions: "Report and write an 800-word profile of a campus figure, with at least three interviewed sources." },
    expected: { grammar: "allowed", research: "not_allowed", draft: "not_allowed", paraphrase: "not_allowed", brainstorm: "unclear" },
    quirk: "Transcription is allowed, which means interview text in a transcript isn't AI writing.",
    origin: "synthetic",
  },
  {
    id: "pol-edu-reflect",
    discipline: "Education",
    level: "grad",
    tier: "disclosure",
    course: "EDUC 520 Learning Theory",
    policy:
      "You may use AI as a thinking partner. For every assignment, include a short reflection on how the AI shaped your thinking and where you disagreed with it. Reflective journals must be written entirely by you.",
    assignment: { title: "Reflective journal week 6", instructions: "Write a 500-word reflection connecting this week's reading on cognitive load to a lesson you taught or observed." },
    expected: { brainstorm: "with_disclosure", draft: "not_allowed", paraphrase: "not_allowed", grammar: "unclear", research: "with_disclosure" },
    quirk: "The general rule is open, but this assignment type is excluded.",
    origin: "synthetic",
  },
  {
    id: "pol-music-theory",
    discipline: "Music",
    level: "intro",
    tier: "prohibited",
    course: "MUSC 102 Music Theory I",
    policy: "No AI tools for harmonization, part-writing, or analysis assignments. Notation software is allowed, but turn off any auto-harmonize or AI suggestion features.",
    assignment: { title: "Part-writing exercise 5", instructions: "Harmonize the given soprano line in four parts following common-practice voice-leading rules, then label all chords with Roman numerals." },
    expected: { draft: "not_allowed", research: "unclear", brainstorm: "unclear", grammar: "unclear", paraphrase: "unclear" },
    quirk: "Non-text work; most text-based uses don't apply.",
    origin: "synthetic",
  },
  {
    id: "pol-soc-data-ethics",
    discipline: "Sociology",
    level: "upper",
    tier: "limited",
    course: "SOCI 360 Qualitative Methods",
    policy:
      "AI may be used to help you organize codes you created and to check grammar. Interview transcripts from your participants may not be uploaded to any AI tool under our IRB protocol. Coding and themes must come from your own reading of the data.",
    assignment: { title: "Thematic analysis memo", instructions: "Code your three interview transcripts and write a 1,500-word memo presenting three themes with supporting quotes." },
    expected: { grammar: "allowed", brainstorm: "unclear", draft: "not_allowed", paraphrase: "unclear", research: "unclear" },
    quirk: "Data-privacy rule (no participant data in AI) on top of the use rule.",
    origin: "synthetic",
  },
  {
    id: "pol-arch-studio",
    discipline: "Architecture",
    level: "upper",
    tier: "open",
    course: "ARCH 402 Design Studio",
    policy:
      "AI image and text tools may be used freely during concept development. Final drawings and models must be produced by you. Document AI use in your process book so we can discuss it at critique.",
    assignment: { title: "Midterm studio project", instructions: "Present a library design for the given site: concept narrative, plans, sections, and a physical model." },
    expected: { brainstorm: "with_disclosure", research: "with_disclosure", draft: "unclear", grammar: "unclear", paraphrase: "unclear" },
    quirk: "Is the concept narrative a 'final' product or concept development? Policy doesn't say.",
    origin: "synthetic",
  },
  {
    id: "pol-pubh-assignment-scale",
    discipline: "Public Health",
    level: "grad",
    tier: "mixed",
    course: "PM 510 Epidemiology",
    policy:
      "This course uses a per-assignment AI scale. Level 1: no AI. Level 2: AI for planning and feedback only. Level 3: AI-assisted drafting with disclosure. Each assignment states its level. Unless stated otherwise, assume Level 1.",
    assignment: { title: "Outbreak investigation brief (Level 2)", instructions: "Write a 1,000-word brief describing the investigation steps for the provided outbreak scenario. AI level 2." },
    expected: { brainstorm: "allowed", grammar: "unclear", paraphrase: "not_allowed", draft: "not_allowed", research: "unclear" },
    quirk: "The rules depend on the level printed in the assignment, not the syllabus.",
    origin: "synthetic",
  },
  {
    id: "pol-acct-exam-prep",
    discipline: "Accounting",
    level: "upper",
    tier: "limited",
    course: "ACCT 410 Auditing",
    policy:
      "You may use AI to quiz yourself and review concepts. Case write-ups are individual and must be written without AI assistance. Grammar checking with built-in tools is fine.",
    assignment: { title: "Audit case write-up", instructions: "Identify the three highest audit risks in the provided case and propose substantive procedures for each in 1,200 words." },
    expected: { research: "allowed", draft: "not_allowed", paraphrase: "not_allowed", grammar: "unclear", brainstorm: "unclear" },
    quirk: "Built-in grammar tools fine, but AI grammar help on the write-up counts as AI assistance.",
    origin: "synthetic",
  },
  {
    id: "pol-env-field",
    discipline: "Environmental Science",
    level: "intro",
    tier: "disclosure",
    course: "ENST 150 Environmental Issues",
    policy:
      "AI use is permitted with acknowledgment. Add a sentence at the end of each assignment naming the tool and what you used it for. If you didn't use AI, you don't need to write anything.",
    assignment: { title: "Field journal entry", instructions: "Describe your observations at the river site, including water clarity, species observed, and one question for further study, in 400 words." },
    expected: { brainstorm: "with_disclosure", grammar: "with_disclosure", paraphrase: "with_disclosure", draft: "with_disclosure", research: "with_disclosure" },
    quirk: "AI-written observations of a site the student visited would be fabrication, but the policy doesn't say so.",
    origin: "synthetic",
  },
  {
    id: "pol-film-script",
    discipline: "Film / Cinematic Arts",
    level: "upper",
    tier: "limited",
    course: "CTWR 320 Screenwriting",
    policy:
      "No AI-generated dialogue, scene description, or story structure in your script. You may use AI to research historical or technical details for your setting. Coverage you write on classmates' scripts must be your own.",
    assignment: { title: "Short film script", instructions: "Write a 12–15 page short film script in standard format with a one-page treatment." },
    expected: { research: "allowed", draft: "not_allowed", brainstorm: "not_allowed", paraphrase: "not_allowed", grammar: "unclear" },
    quirk: "AI for story structure is banned, which covers most brainstorming.",
    origin: "synthetic",
  },
  {
    id: "pol-ling-detection",
    discipline: "Linguistics",
    level: "upper",
    tier: "disclosure",
    course: "LING 310 Syntax",
    policy:
      "AI tools may be used to check your tree diagrams after you've drawn them, with a note saying which ones you checked. AI may not generate the analysis. I will spot-check understanding in office-hour conversations.",
    assignment: { title: "Problem set 5: Movement", instructions: "Draw trees for the ten sentences, identify each movement operation, and explain any island violations." },
    expected: { research: "with_disclosure", draft: "not_allowed", brainstorm: "unclear", grammar: "unclear", paraphrase: "unclear" },
    quirk: "Checking after the fact is allowed; generating first is not. The order matters in the transcript.",
    origin: "synthetic",
  },
  {
    id: "pol-anth-ethno",
    discipline: "Anthropology",
    level: "intro",
    tier: "prohibited",
    course: "ANTH 101 Cultural Anthropology",
    policy:
      "Because this course is about learning to observe and interpret culture yourself, AI tools are not permitted for any written assignment. If you are unsure whether a tool counts as AI, ask me before using it.",
    assignment: { title: "Mini-ethnography", instructions: "Observe a public space for two hours and write a 1,000-word ethnographic account with thick description." },
    expected: { brainstorm: "not_allowed", grammar: "unclear", paraphrase: "not_allowed", draft: "not_allowed", research: "not_allowed" },
    quirk: "Whether basic grammar check 'counts as AI' is left to asking the instructor.",
    origin: "synthetic",
  },
  {
    id: "pol-ds-notebook",
    discipline: "Data Science",
    level: "grad",
    tier: "open",
    course: "DSCI 552 Machine Learning for Data Science",
    policy:
      "AI assistants are allowed for all coding and writing. Include a markdown cell at the end of your notebook listing the prompts that substantially shaped your solution. Undisclosed AI use is treated the same as undisclosed collaboration.",
    assignment: { title: "Project 2: Model comparison", instructions: "Train and compare three classifiers on the provided dataset, justify your evaluation metric, and discuss failure cases in the notebook." },
    expected: { brainstorm: "with_disclosure", code: "with_disclosure", draft: "with_disclosure", paraphrase: "with_disclosure", grammar: "with_disclosure", research: "with_disclosure" },
    quirk: "Disclosure is a list of prompts, not a statement.",
    origin: "synthetic",
  },
  {
    id: "pol-rel-no-disclosure-rule",
    discipline: "Religious Studies",
    level: "intro",
    tier: "limited",
    course: "REL 120 World Religions",
    policy: "You may use AI to help you understand difficult readings. Your papers must be your own work.",
    assignment: { title: "Comparison paper", instructions: "Compare how two traditions from the course understand suffering, in 1,000 words, citing the assigned primary texts." },
    expected: { research: "allowed", draft: "not_allowed", brainstorm: "unclear", grammar: "unclear", paraphrase: "unclear" },
    quirk: "Says nothing about disclosure; the analyzer shouldn't invent a disclosure requirement.",
    origin: "synthetic",
  },
];

export const USES: Use[] = ["brainstorm", "grammar", "paraphrase", "draft", "research", "code"];

export function policyCaseSummary() {
  const by = <K extends string>(f: (p: PolicyCase) => K) =>
    POLICY_CASES.reduce<Record<string, number>>((m, p) => ((m[f(p)] = (m[f(p)] ?? 0) + 1), m), {});
  return { total: POLICY_CASES.length, byTier: by((p) => p.tier), byDiscipline: by((p) => p.discipline) };
}
