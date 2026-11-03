import type { Context } from "grammy";

export type Answers = Record<string, string>;

export interface Option {
  label: string;
  value: string;
}

export interface ChoiceStep {
  kind: "choice";
  key: string;
  prompt: string;
  options: Option[];
  // When this returns true, the step is skipped
  skipIf?: (answers: Answers) => boolean;
}

export interface TextStep {
  kind: "text";
  key: string;
  prompt: string;
  // Returns an error message for invalid input, or null when valid
  validate?: (input: string) => string | null;
  skipIf?: (answers: Answers) => boolean;
}

export type Step = ChoiceStep | TextStep;

export interface Flow {
  // Short id used in callback data. Lowercase letters and digits only.
  id: string;
  steps: Step[];
  finish: (ctx: Context, answers: Answers) => Promise<void>;
}
