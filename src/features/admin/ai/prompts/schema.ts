import { z } from "zod";

import {
  jsonTextSchema,
  nullableTextSchema,
  tagsSchema,
  uuidSchema,
} from "../schema";

/**
 * Prompt template이 공백만으로 구성되지 않았는지 검증합니다.
 *
 * 실제 template 값의 앞뒤 공백은 보존하고 유효성만 확인합니다.
 */
const promptTemplateSchema = z
  .string()
  .refine((value) => value.trim().length > 0, {
    message: "Prompt template을 입력해주세요.",
  });

/**
 * Prompt Family 생성 입력을 검증하고 정규화합니다.
 */
export const createFamilySchema = z.object({
  agentId: uuidSchema,
  changeSummary: nullableTextSchema,
  description: nullableTextSchema,
  displayName: z.string().trim().min(1),
  responseSchema: jsonTextSchema,
  systemTemplate: promptTemplateSchema,
  tags: tagsSchema,
  userTemplate: promptTemplateSchema,
  variables: jsonTextSchema,
  versionDisplayName: z.string().trim().min(1),
});

/**
 * Prompt Family 수정 입력을 검증하고 정규화합니다.
 */
export const updateFamilySchema = z.object({
  description: nullableTextSchema,
  displayName: z.string().trim().min(1),
  familyId: uuidSchema,
  tags: tagsSchema,
});

/**
 * Prompt Version 생성 입력을 검증하고 정규화합니다.
 */
export const createVersionSchema = z.object({
  changeSummary: nullableTextSchema,
  familyId: uuidSchema,
  responseSchema: jsonTextSchema,
  systemTemplate: promptTemplateSchema,
  tags: tagsSchema,
  userTemplate: promptTemplateSchema,
  variables: jsonTextSchema,
  versionDisplayName: z.string().trim().min(1),
});

/**
 * Prompt Version 수정 입력을 검증하고 정규화합니다.
 */
export const updateVersionSchema = createVersionSchema.extend({
  versionId: uuidSchema,
});

/**
 * 관리자 Prompt Family 목록 RPC의 개별 row를 검증합니다.
 */
export const adminAiPromptFamilyListRpcRowSchema = z.object({
  agent_display_name: z.string(),
  agent_id: uuidSchema,
  archived_version_count: z.number(),
  created_at: z.string(),
  display_name: z.string(),
  draft_version_count: z.number(),
  id: uuidSchema,
  published_version_count: z.number(),
  updated_at: z.string(),
});

/**
 * 관리자 Prompt Family 목록 RPC의 최상위 결과 구조를 검증합니다.
 *
 * items는 개별 row schema로 별도 검증하므로 이 단계에서는 unknown으로 유지합니다.
 */
export const adminAiPromptFamilyListRpcResultSchema = z
  .array(
    z.object({
      items: z.unknown(),
      total_count: z.number(),
    }),
  )
  .length(1);
