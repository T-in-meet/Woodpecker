import { z } from "zod";

/**
 * Google Gemini GenerateContent API 응답 스키마입니다.
 */
export const googleChatCompletionResponseSchema = z.object({
  candidates: z
    .array(
      z.object({
        content: z
          .object({
            parts: z.array(
              z.object({
                text: z.string().optional(),
                thought: z.boolean().optional(),
              }),
            ),
            role: z.string().optional(),
          })
          .optional(),
        finishMessage: z.string().optional(),
        finishReason: z.string().optional(),
        index: z.number().int().nonnegative().optional(),
      }),
    )
    .optional(),
  modelVersion: z.string().optional(),
  promptFeedback: z
    .object({
      blockReason: z.string().optional(),
      blockReasonMessage: z.string().optional(),
    })
    .optional(),
  responseId: z.string().optional(),
  usageMetadata: z
    .object({
      cachedContentTokenCount: z.number().int().nonnegative().optional(),
      candidatesTokenCount: z.number().int().nonnegative().optional(),
      promptTokenCount: z.number().int().nonnegative().optional(),
      thoughtsTokenCount: z.number().int().nonnegative().optional(),
      totalTokenCount: z.number().int().nonnegative().optional(),
    })
    .optional(),
});

/**
 * Google Gemini EmbedContent API 응답 스키마입니다.
 */
export const googleEmbeddingResponseSchema = z.object({
  embedding: z.object({
    shape: z.array(z.number().int().nonnegative()).optional(),
    values: z.array(z.number()),
  }),
  usageMetadata: z
    .object({
      promptTokenCount: z.number().int().nonnegative().optional(),
      promptTokenDetails: z
        .array(
          z.object({
            modality: z.string().optional(),
            tokenCount: z.number().int().nonnegative().optional(),
          }),
        )
        .optional(),
    })
    .optional(),
});
