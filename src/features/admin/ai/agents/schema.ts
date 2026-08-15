import { z } from "zod";

import { nullableTextSchema, tagsSchema, uuidSchema } from "../schema";

export const createAgentSchema = z.object({
  description: nullableTextSchema,
  displayName: z.string().trim().min(1),
  purpose: z.string().trim().min(1),
  tags: tagsSchema,
});

export const updateAgentSchema = z.object({
  agentId: uuidSchema,
  description: nullableTextSchema,
  displayName: z.string().trim().min(1),
  purpose: z.string().trim().min(1),
  tags: tagsSchema,
});

/** Agent 삭제 RPC가 반환하는 허용된 결과 코드입니다. */
export const adminAiAgentDeleteRpcResultSchema = z.union([
  z.literal("NOT_FOUND"),
  z.literal("OK"),
]);

export const adminAiAgentListRpcRowSchema = z.object({
  created_at: z.string(),
  display_name: z.string(),
  family_count: z.number(),
  id: z.string(),
  purpose: z.string().nullable(),
  updated_at: z.string(),
});

export const adminAiAgentListRpcResultSchema = z
  .array(
    z.object({
      items: z.unknown(),
      total_count: z.number(),
    }),
  )
  .length(1);

/** Agent 선택 목록 조회에 필요한 최소 DB row 구조입니다. */
export const adminAiAgentOptionRowSchema = z.object({
  display_name: z.string(),
  id: z.string(),
});
