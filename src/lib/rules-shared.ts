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

