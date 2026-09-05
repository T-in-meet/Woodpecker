import { z } from "zod";

import { quizQuestionSchema, quizTypeSchema } from "../schema";

/** AI 실행 단계 오류의 공통 Snapshot 형식입니다. */
const aiRunErrorSnapshotSchema = z.object({
  type: z.string(),
  message: z.string(),
  issues: z.array(z.unknown()).optional(),
});

/** Quiz 생성에 실제 사용된 Note 입력 형식입니다. */
const quizSourceNoteSnapshotSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  content: z.string(),
});

/** Quiz 생성 진입 action 형식입니다. */
export const quizActionSnapshotSchema = z.enum(["generate", "regenerate"]);

/** Quiz 생성 AI Run의 authoritative Snapshot 문서 형식입니다. */
export const quizSnapshotsSchema = z.object({
  schemaVersion: z.literal(1),
  sourceInput: z.object({
    input: z.object({
      note: quizSourceNoteSnapshotSchema,
      quizType: quizTypeSchema,
      action: quizActionSnapshotSchema,
    }),
  }),
  generationInput: z
    .object({
      input: z.object({ history: z.array(z.array(z.string())) }),
      output: z.object({ previousQuestions: z.array(z.string()) }),
    })
    .optional(),
  generationPreparation: z
    .object({
      input: z.object({
        source: z.object({ title: z.string(), content: z.string() }),
        quizType: quizTypeSchema,
        previousQuestions: z.array(z.string()),
      }),
      configuration: z.object({
        maxQuestions: z.number().int().positive(),
        perspective: z.string(),
        temperature: z.number(),
      }),
      output: z.object({
        selectedPerspective: z.string(),
        renderedPrompt: z.string(),
        responseSchema: z.unknown(),
      }),
      error: aiRunErrorSnapshotSchema.optional(),
    })
    .optional(),
  quizGeneration: z
    .object({
      input: z.object({ prompt: z.string(), responseSchema: z.unknown() }),
      configuration: z.object({
        provider: z.string(),
        model: z.string(),
        temperature: z.number(),
        maxTokens: z.number().int().positive(),
        reasoningEffort: z.string().optional(),
        responseFormat: z
          .object({
            type: z.literal("json_schema"),
            json_schema: z.unknown(),
          })
          .optional(),
        timeoutMs: z.number().int().nonnegative().optional(),
      }),
      output: z
        .object({
          rawResponse: z.unknown().optional(),
          responseText: z.string().optional(),
          providerMetadata: z
            .object({ finishReason: z.string().optional() })
            .optional(),
        })
        .optional(),
      error: aiRunErrorSnapshotSchema
        .extend({
          kind: z.string().optional(),
          code: z.number().int().optional(),
          status: z.number().int().optional(),
        })
        .optional(),
    })
    .optional(),
  responseExtraction: z
    .object({
      input: z.object({ rawResponse: z.unknown() }),
      output: z.object({ responseText: z.string() }).optional(),
      error: aiRunErrorSnapshotSchema.optional(),
    })
    .optional(),
  parseAndValidation: z
    .object({
      input: z.object({ responseText: z.string() }),
      configuration: z.object({ quizType: quizTypeSchema }),
      output: z
        .object({
          parsedResponse: z.unknown().optional(),
          validatedQuestions: z.array(quizQuestionSchema).optional(),
        })
        .optional(),
      error: aiRunErrorSnapshotSchema.optional(),
    })
    .optional(),
  finalOutput: z.object({ questions: z.array(quizQuestionSchema) }).optional(),
});

/** Quiz 생성 AI Run Snapshot 타입입니다. */
export type QuizSnapshots = z.infer<typeof quizSnapshotsSchema>;

/** Quiz 생성 action 타입입니다. */
export type QuizAction = z.infer<typeof quizActionSnapshotSchema>;
