import { z } from "zod";

import {
  AI_PROMPT_CREATED_BY_KIND,
  AI_PROMPT_LIFECYCLE_STATUS,
} from "../constants/prompts";

/**
 * AI Prompt Version을 생성한 주체의 유형을 검증합니다.
 */
export const aiPromptCreatedByKindSchema = z.enum([
  AI_PROMPT_CREATED_BY_KIND.SYSTEM,
  AI_PROMPT_CREATED_BY_KIND.USER,
]);

/**
 * AI Prompt Version의 lifecycle 상태를 검증합니다.
 *
 * Prompt Version은 Draft, Published, Archived 중 하나의 상태를 가집니다.
 */
export const aiPromptLifecycleStatusSchema = z.enum([
  AI_PROMPT_LIFECYCLE_STATUS.ARCHIVED,
  AI_PROMPT_LIFECYCLE_STATUS.DRAFT,
  AI_PROMPT_LIFECYCLE_STATUS.PUBLISHED,
]);

/**
 * DB에서 조회한 AI Prompt Agent row의 런타임 구조를 검증합니다.
 *
 * Agent의 식별 정보와 관리 메타데이터를 검증합니다.
 */
export const aiPromptAgentRowSchema = z.object({
  created_at: z.string(),
  description: z.string().nullable(),
  display_name: z.string().min(1),
  id: z.string().uuid(),
  purpose: z.string().nullable(),
  tags: z.array(z.string()),
  updated_at: z.string(),
});

/**
 * DB에서 조회한 AI Prompt Family row의 런타임 구조를 검증합니다.
 *
 * Family가 속한 Agent 관계와 관리 메타데이터를 검증합니다.
 */
export const aiPromptFamilyRowSchema = z.object({
  agent_id: z.string().uuid(),
  created_at: z.string(),
  description: z.string().nullable(),
  display_name: z.string().min(1),
  id: z.string().uuid(),
  tags: z.array(z.string()),
  updated_at: z.string(),
});

/**
 * DB에서 조회한 AI Prompt Version row의 런타임 구조를 검증합니다.
 *
 * Prompt Version의 Family 관계, lifecycle 상태, template, response schema,
 * variables 및 생성 메타데이터를 검증합니다.
 */
export const aiPromptVersionRowSchema = z.object({
  change_summary: z.string().nullable(),
  created_at: z.string(),
  created_by: z.string().uuid().nullable(),
  created_by_kind: aiPromptCreatedByKindSchema,
  display_name: z.string().min(1),
  family_id: z.string().uuid(),
  id: z.string().uuid(),
  lifecycle_status: aiPromptLifecycleStatusSchema,
  response_schema: z.unknown(),
  system_template: z.string().min(1),
  tags: z.array(z.string()),
  user_template: z.string().min(1),
  variables: z.unknown(),
  version_number: z.number().int().positive(),
});
