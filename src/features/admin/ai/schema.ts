import { z } from "zod";

import type { Json } from "@/types/db.helpers";

/** UUID 형식의 문자열을 검증합니다. */
export const uuidSchema = z.string().uuid();

/**
 * 선택 입력 텍스트를 정리합니다.
 *
 * 앞뒤 공백을 제거하고 빈 문자열은 null로 변환합니다.
 */
export const nullableTextSchema = z
  .string()
  .trim()
  .transform((value) => (value.length > 0 ? value : null));

/**
 * 쉼표로 구분된 태그 문자열을 태그 배열로 변환합니다.
 *
 * 각 태그의 앞뒤 공백과 빈 항목은 제거합니다.
 */
export const tagsSchema = z.string().transform((value) =>
  value
    .split(",")
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0),
);

/**
 * JSON 문자열 입력을 애플리케이션의 Json 값으로 변환합니다.
 *
 * 빈 문자열은 null로 처리하고, 유효하지 않은 JSON은 검증 오류로 반환합니다.
 */
export const jsonTextSchema = z.string().transform((value, context): Json => {
  const trimmedValue = value.trim();

  if (trimmedValue.length === 0) {
    return null;
  }

  try {
    return JSON.parse(trimmedValue) as Json;
  } catch {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "JSON 형식이 올바르지 않습니다.",
    });

    return z.NEVER;
  }
});

/** 관리자 Prompt Version의 lifecycle 상태를 검증합니다. */
export const aiPromptVersionStatusSchema = z.union([
  z.literal("draft"),
  z.literal("published"),
  z.literal("archived"),
]);

/**
 * DB에서 조회한 관리자 Prompt Family row 구조를 검증합니다.
 */
export const aiPromptFamilyRowSchema = z.object({
  agent_id: z.string(),
  created_at: z.string(),
  description: z.string().nullable(),
  display_name: z.string(),
  id: z.string(),
  tags: z.array(z.string()),
  updated_at: z.string(),
});

/**
 * DB에서 조회한 관리자 Prompt Version row 구조를 검증합니다.
 */
export const aiPromptVersionRowSchema = z.object({
  change_summary: z.string().nullable(),
  created_at: z.string(),
  created_by: z.string().nullable(),
  created_by_kind: z.string(),
  display_name: z.string(),
  family_id: z.string(),
  id: z.string(),
  lifecycle_status: aiPromptVersionStatusSchema,
  response_schema: z.unknown(),
  system_template: z.string(),
  tags: z.array(z.string()),
  user_template: z.string(),
  variables: z.unknown(),
  version_number: z.number(),
});
