import type { z } from "zod";

import type {
  aiPromptAgentRowSchema,
  aiPromptFamilyRowSchema,
  aiPromptVersionRowSchema,
} from "./schema";

/** DB에서 조회한 AI prompt agent 행입니다. */
export type AiPromptAgent = z.infer<typeof aiPromptAgentRowSchema>;

/** DB에서 조회한 AI prompt family 행입니다. */
export type AiPromptFamily = z.infer<typeof aiPromptFamilyRowSchema>;

/** DB에서 조회한 AI prompt version 행입니다. */
export type AiPromptVersion = z.infer<typeof aiPromptVersionRowSchema>;

/** LLM 실행 기록에 저장할 수 있는 prompt version snapshot입니다. */
export type AiPromptSnapshot = {
  agentId: string;
  familyId: string;
  promptVersionId: string;
  versionNumber: number;
  displayName: string;
  lifecycleStatus: string;
  systemTemplate: string;
  userTemplate: string;
  responseSchema: unknown;
  variables: unknown;
  tags: string[];
};
