import { z } from "zod";

/** AI Run 단계 오류의 공통 Snapshot schema입니다. */
const aiRunErrorSnapshotSchema = z.object({
  type: z.string(),
  message: z.string(),
  issues: z.array(z.unknown()).optional(),
});

/** 채점에 사용한 Note Snapshot schema입니다. */
const reviewGradingSourceNoteSnapshotSchema = z.object({
  id: z.string().uuid(),
  content: z.string(),
});

/** 채점 대상 Review Log Snapshot schema입니다. */
const reviewLogSnapshotSchema = z.object({
  id: z.string().uuid(),
  noteId: z.string().uuid(),
  round: z.number().int().positive(),
  scheduledAt: z.string(),
  completedAt: z.string().nullable(),
});

/** Review Grading 실행의 원본 입력 Snapshot schema입니다. */
const sourceInputSnapshotSchema = z.object({
  input: z.object({
    note: reviewGradingSourceNoteSnapshotSchema,
    reviewLog: reviewLogSnapshotSchema,
    answer: z.string(),
    originalContentHash: z.string(),
    currentContentHash: z.string(),
  }),
});

/** Cloudflare Provider 실패 Snapshot schema입니다. */
const reviewGradingProviderErrorSnapshotSchema =
  aiRunErrorSnapshotSchema.extend({
    kind: z
      .enum([
        "config",
        "timeout",
        "aborted",
        "network",
        "provider",
        "truncated",
      ])
      .optional(),
    code: z.number().int().optional(),
    status: z.number().int().optional(),
  });

/** Provider가 반환한 생성 종료 metadata Snapshot schema입니다. */
const reviewGradingProviderMetadataSnapshotSchema = z.object({
  finishReason: z.string().optional(),
});

/** Review Grading Provider 생성 단계 Snapshot schema입니다. */
const gradingGenerationSnapshotSchema = z.object({
  input: z.object({
    messages: z.array(
      z.object({
        role: z.string(),
        content: z.string(),
      }),
    ),
  }),
  configuration: z.object({
    provider: z.string(),
    model: z.string(),
    temperature: z.number().nullable().optional(),
    maxTokens: z.number().int().positive(),
    reasoningEffort: z.string().optional(),
    responseFormat: z.unknown(),
    timeoutMs: z.number().int().nonnegative().optional(),
  }),
  output: z
    .object({
      rawResponse: z.unknown(),
      providerMetadata: reviewGradingProviderMetadataSnapshotSchema.optional(),
    })
    .optional(),
  error: reviewGradingProviderErrorSnapshotSchema.optional(),
});

/** Provider 결과에서 JSON 문자열을 추출한 단계 Snapshot schema입니다. */
const responseExtractionSnapshotSchema = z.object({
  output: z
    .object({
      responseText: z.string(),
    })
    .optional(),
  error: aiRunErrorSnapshotSchema.optional(),
});

/** 검증되거나 정규화된 채점 결과 Snapshot schema입니다. */
const gradingSnapshotSchema = z.object({
  score: z.number().int().min(0).max(100),
  summary: z.string(),
  missedConcepts: z.array(z.string()),
  incorrectPoints: z.array(z.string()),
});

/** JSON parse와 grading schema validation 단계 Snapshot schema입니다. */
const parseAndValidationSnapshotSchema = z.object({
  configuration: z.object({
    validationSchema: z.unknown(),
  }),
  output: z
    .object({
      validatedGrading: gradingSnapshotSchema.optional(),
    })
    .optional(),
  error: aiRunErrorSnapshotSchema.optional(),
});

/** 피드백 항목 개수를 제한하는 정규화 단계 Snapshot schema입니다. */
const normalizationSnapshotSchema = z.object({
  configuration: z.object({
    feedbackItemsMax: z.number().int().positive(),
  }),
});

/** AI 처리 경계에서 확정된 최종 채점 Snapshot schema입니다. */
const finalOutputSnapshotSchema = z.object({
  grading: gradingSnapshotSchema,
});

/** Review Grading AI Run의 authoritative Snapshot schema입니다. */
export const reviewGradingSnapshotsSchema = z.object({
  schemaVersion: z.literal(1),
  sourceInput: sourceInputSnapshotSchema,
  gradingGeneration: gradingGenerationSnapshotSchema.optional(),
  responseExtraction: responseExtractionSnapshotSchema.optional(),
  parseAndValidation: parseAndValidationSnapshotSchema.optional(),
  normalization: normalizationSnapshotSchema.optional(),
  finalOutput: finalOutputSnapshotSchema.optional(),
});

/** 검증된 Review Grading AI Run Snapshot 타입입니다. */
export type ReviewGradingSnapshots = z.infer<
  typeof reviewGradingSnapshotsSchema
>;
