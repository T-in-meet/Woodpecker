import { z } from "zod";

export const openAiChatCompletionResponseSchema = z.object({
  choices: z
    .array(
      z.object({
        finish_reason: z.string().nullable().optional(),
        message: z.object({
          content: z.string().nullable(),
        }),
      }),
    )
    .min(1),
  created: z.number().int().nonnegative().optional(),
  id: z.string().optional(),
  model: z.string().optional(),
  system_fingerprint: z.string().nullable().optional(),
  usage: z
    .object({
      completion_tokens: z.number().int().nonnegative().optional(),
      prompt_tokens: z.number().int().nonnegative().optional(),
      total_tokens: z.number().int().nonnegative().optional(),
    })
    .optional(),
});

export const openAiEmbeddingResponseSchema = z.object({
  data: z
    .array(
      z.object({
        embedding: z.array(z.number()),
      }),
    )
    .min(1),
  model: z.string().optional(),
  usage: z
    .object({
      prompt_tokens: z.number().int().nonnegative().optional(),
      total_tokens: z.number().int().nonnegative().optional(),
    })
    .optional(),
});
