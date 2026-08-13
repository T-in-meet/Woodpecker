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

export const adminAiAgentRowSchema = z.object({
  created_at: z.string(),
  description: z.string().nullable(),
  display_name: z.string(),
  id: z.string(),
  purpose: z.string().nullable(),
  tags: z.array(z.string()),
  updated_at: z.string(),
});
