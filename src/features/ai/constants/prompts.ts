/** Prompt version의 배포 상태입니다. */
export const AI_PROMPT_LIFECYCLE_STATUS = {
  ARCHIVED: "archived",
  DRAFT: "draft",
  PUBLISHED: "published",
} as const;

/** Prompt version 생성 주체의 종류입니다. */
export const AI_PROMPT_CREATED_BY_KIND = {
  SYSTEM: "system",
  USER: "user",
} as const;

/** 기능 코드가 명시적으로 요청해야 하는 prompt agent key입니다. */
export const AI_PROMPT_KEY = {
  NOTES_RAG_ANSWER: "notes.rag.answer",
} as const;

/** Prompt version 배포 상태 타입입니다. */
export type AiPromptLifecycleStatus =
  (typeof AI_PROMPT_LIFECYCLE_STATUS)[keyof typeof AI_PROMPT_LIFECYCLE_STATUS];

/** Prompt version 생성 주체 타입입니다. */
export type AiPromptCreatedByKind =
  (typeof AI_PROMPT_CREATED_BY_KIND)[keyof typeof AI_PROMPT_CREATED_BY_KIND];

/** Foundation seed와 기능 코드가 공유하는 prompt agent key 타입입니다. */
export type AiPromptKey = (typeof AI_PROMPT_KEY)[keyof typeof AI_PROMPT_KEY];
