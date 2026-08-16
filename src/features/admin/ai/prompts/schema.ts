import { z } from "zod";

import {
  jsonTextSchema,
  nullableTextSchema,
  tagsSchema,
  uuidSchema,
} from "../schema";

/**
 * 값이 JSON object로 저장 가능한 top-level object인지 확인합니다.
 *
 * 배열과 null은 JSON object와 별도 타입으로 취급하므로 거부합니다.
 *
 * @param value 검증할 JSON 파싱 결과
 * @returns top-level JSON object 여부
 */
function isTopLevelJsonObject(value: z.infer<typeof jsonTextSchema>): boolean {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/**
 * JSON 문자열 입력을 response_schema DB 제약과 동일한 object/null로 검증합니다.
 */
const responseSchemaJsonTextSchema = jsonTextSchema.refine(
  (value) => value === null || isTopLevelJsonObject(value),
  {
    message: "Response Schema는 JSON 객체로 입력해주세요.",
  },
);

/**
 * JSON 문자열 입력을 variables DB 제약과 동일한 array/null로 검증합니다.
 */
const variablesJsonTextSchema = jsonTextSchema.refine(
  (value) => value === null || Array.isArray(value),
  {
    message: "Variables는 JSON 배열로 입력해주세요.",
  },
);

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
  responseSchema: responseSchemaJsonTextSchema,
  systemTemplate: promptTemplateSchema,
  tags: tagsSchema,
  userTemplate: promptTemplateSchema,
  variables: variablesJsonTextSchema,
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
  responseSchema: responseSchemaJsonTextSchema,
  systemTemplate: promptTemplateSchema,
  tags: tagsSchema,
  userTemplate: promptTemplateSchema,
  variables: variablesJsonTextSchema,
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
