// Client-safe pieces of the rules card (no server imports).

export type UseStance = "allowed" | "with_disclosure" | "not_allowed" | "unclear" | "n/a";
export type CardUse = "brainstorm" | "grammar" | "paraphrase" | "draft" | "research" | "code";
export const CARD_USES: { key: CardUse; label: string }[] = [
  { key: "brainstorm", label: "Brainstorming and outlining" },
  { key: "grammar", label: "Grammar help from an AI tool" },
  { key: "paraphrase", label: "Rewording your own sentences" },
  { key: "draft", label: "Using text an AI wrote" },
  { key: "research", label: "Explaining concepts or finding sources" },
  { key: "code", label: "Writing or fixing code" },
];


export const STANCE_LABEL: Record<UseStance, string> = {
  allowed: "Allowed",
  with_disclosure: "Allowed if disclosed",
  not_allowed: "Not allowed",
  unclear: "Not sure: flag for follow-up",
  "n/a": "Doesn't apply",
};

export type RulesMode = "syllabus" | "no_ai" | "custom";
export const RULES_MODE_LABEL: Record<RulesMode, string> = {
  syllabus: "Same as syllabus",
  no_ai: "No AI use allowed",
  custom: "Custom",
};
