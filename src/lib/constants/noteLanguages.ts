export const NOTE_LANGUAGE_VALUES = [
  "markdown",
  "javascript",
  "typescript",
  "python",
  "rust",
  "go",
] as const;

export type NoteLanguage = (typeof NOTE_LANGUAGE_VALUES)[number];

export const CODE_LANGUAGE_VALUES = NOTE_LANGUAGE_VALUES.filter(
  (language): language is Exclude<NoteLanguage, "markdown"> =>
    language !== "markdown",
);

export type CodeLanguage = (typeof CODE_LANGUAGE_VALUES)[number];
