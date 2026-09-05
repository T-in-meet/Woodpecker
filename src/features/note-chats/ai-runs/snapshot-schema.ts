import { z } from "zod";

/** AI Provider token 사용량 Snapshot schema입니다. */
const aiUsageSnapshotSchema = z
  .object({
    inputTokens: z.number().nonnegative().optional(),
    outputTokens: z.number().nonnegative().optional(),
    totalTokens: z.number().nonnegative().optional(),
    raw: z.record(z.string(), z.unknown()).optional(),
  })
  .optional();

/** Note Chat 대화 이력 메시지 Snapshot schema입니다. */
const noteChatHistoryMessageSnapshotSchema = z.object({
  id: z.string().optional(),
  role: z.enum(["user", "assistant"]),
  content: z.string(),
});

/** Chat Model 실행 설정 Snapshot schema입니다. */
const chatModelSnapshotSchema = z.object({
  id: z.string().optional(),
  provider: z.string(),
  model: z.string(),
  settings: z.record(z.string(), z.unknown()).optional(),
});

/** Embedding Model 실행 설정 Snapshot schema입니다. */
const embeddingModelSnapshotSchema = z.object({
  id: z.string().optional(),
  provider: z.string(),
  model: z.string(),
  settings: z.record(z.string(), z.unknown()).optional(),
});

/** Prompt 실행 설정 Snapshot schema입니다. */
const promptSnapshotSchema = z.object({
  agentId: z.string().optional(),
  familyId: z.string().optional(),
  versionId: z.string().optional(),
  agent: z.record(z.string(), z.unknown()).optional(),
  family: z.record(z.string(), z.unknown()).optional(),
  version: z.record(z.string(), z.unknown()),
});

/** Query Expansion 실패 정보 Snapshot schema입니다. */
const queryExpansionErrorSnapshotSchema = z.object({
  type: z.string().optional(),
  message: z.string(),
  rawResponse: z.string().optional(),
  validationIssues: z.array(z.unknown()).optional(),
  providerError: z.unknown().optional(),
});

/** Query Expansion 단계 Snapshot schema입니다. */
const queryExpansionSnapshotSchema = z.object({
  input: z.object({
    question: z.string(),
    history: z.array(noteChatHistoryMessageSnapshotSchema),
    providerInput: z.object({
      systemPrompt: z.string(),
      userPrompt: z.string(),
    }),
    variables: z.record(z.string(), z.unknown()).optional(),
  }),
  configuration: z.object({
    model: chatModelSnapshotSchema,
    prompt: promptSnapshotSchema,
    temperature: z.number().optional(),
    responseFormat: z.unknown().optional(),
  }),
  output: z
    .object({
      rawResponse: z.string(),
      parsed: z.object({ expandedQuery: z.string() }).optional(),
    })
    .optional(),
  error: queryExpansionErrorSnapshotSchema.optional(),
  usage: aiUsageSnapshotSchema,
});

/** Retrieval 검색 match Snapshot schema입니다. */
const retrievalSearchMatchSnapshotSchema = z.object({
  embeddingId: z.string().optional(),
  noteId: z.string().optional(),
  sourceId: z.string().optional(),
  similarity: z.number().optional(),
  distance: z.number().optional(),
  raw: z.record(z.string(), z.unknown()).optional(),
});

/** Hydration된 검색 후보 Snapshot schema입니다. */
const hydratedCandidateSnapshotSchema = z.object({
  embeddingId: z.string().optional(),
  noteId: z.string().optional(),
  sourceId: z.string().optional(),
  similarity: z.number().optional(),
  distance: z.number().optional(),
  note: z.object({
    id: z.string().optional(),
    title: z.string().nullable().optional(),
  }),
  chunk: z.object({
    id: z.string().optional(),
    inputText: z.string(),
  }),
});

/** Retrieval source Snapshot schema입니다. */
const retrievalSourceSnapshotSchema = z.object({
  noteId: z.string().optional(),
  title: z.string().nullable().optional(),
  inputText: z.string(),
  embeddingId: z.string().optional(),
  sourceId: z.string().optional(),
});

/** Retrieval 실패 stage schema입니다. */
export const retrievalErrorStageSchema = z.enum([
  "embedding",
  "search",
  "hydration",
  "context_selection",
  "context_build",
]);

/** Retrieval 단계 Snapshot schema입니다. */
const retrievalSnapshotSchema = z.object({
  input: z.object({ inputText: z.string() }),
  configuration: z.object({
    embeddingModel: embeddingModelSnapshotSchema,
    dimensions: z.number().int().positive().optional(),
    search: z.object({
      matchLimit: z.number().int().positive(),
      contextLimit: z.number().int().nonnegative(),
      minSimilarity: z.number().optional(),
      sourceType: z.string().optional(),
      inputKind: z.string().optional(),
    }),
  }),
  embedding: z
    .object({
      usage: z
        .object({
          inputTokens: z.number().nonnegative().optional(),
          totalTokens: z.number().nonnegative().optional(),
          raw: z.record(z.string(), z.unknown()).optional(),
        })
        .optional(),
      metadata: z.record(z.string(), z.unknown()).optional(),
    })
    .optional(),
  searchResult: z
    .object({ matches: z.array(retrievalSearchMatchSnapshotSchema) })
    .optional(),
  hydratedCandidates: z.array(hydratedCandidateSnapshotSchema).optional(),
  output: z
    .object({
      selectedCandidateIndexes: z.array(z.number().int().nonnegative()),
      context: z.string(),
      sources: z.array(retrievalSourceSnapshotSchema),
    })
    .optional(),
  error: z
    .object({
      type: z.string().optional(),
      message: z.string(),
      stage: retrievalErrorStageSchema.optional(),
      providerError: z.unknown().optional(),
      details: z.unknown().optional(),
    })
    .optional(),
});

/** Answer Provider 메시지 Snapshot schema입니다. */
const providerMessageSnapshotSchema = z.object({
  role: z.string(),
  content: z.unknown(),
});

/** 실행된 Answer Generation Snapshot schema입니다. */
const executedAnswerGenerationSnapshotSchema = z.object({
  status: z.literal("executed"),
  input: z.object({
    question: z.string(),
    history: z.array(noteChatHistoryMessageSnapshotSchema),
    context: z.string(),
    providerMessages: z.array(providerMessageSnapshotSchema),
  }),
  configuration: z.object({
    model: chatModelSnapshotSchema,
    prompt: promptSnapshotSchema,
    temperature: z.number().optional(),
    responseFormat: z.unknown().optional(),
  }),
  output: z
    .object({
      rawResponse: z.string(),
      parsed: z
        .object({
          answer: z.string(),
          usedContextIndexes: z.array(z.number().int().nonnegative()),
        })
        .optional(),
      partialResponse: z.string().optional(),
    })
    .optional(),
  postProcessing: z
    .object({
      usedContextIndexes: z.array(z.number().int().nonnegative()),
      usedNoteIds: z.array(z.string()),
    })
    .optional(),
  error: z
    .object({
      type: z.string().optional(),
      message: z.string(),
      stage: z
        .enum([
          "provider_call",
          "stream_consumption",
          "parse",
          "validation",
          "post_processing",
        ])
        .optional(),
      rawResponse: z.string().optional(),
      partialResponse: z.string().optional(),
      validationIssues: z.array(z.unknown()).optional(),
      providerError: z.unknown().optional(),
    })
    .optional(),
  usage: aiUsageSnapshotSchema,
});

/** Context가 없어 건너뛴 Answer Generation Snapshot schema입니다. */
const skippedAnswerGenerationSnapshotSchema = z.object({
  status: z.literal("skipped"),
  reason: z.literal("no_context"),
});

/** Answer Generation 단계 Snapshot schema입니다. */
const answerGenerationSnapshotSchema = z.discriminatedUnion("status", [
  executedAnswerGenerationSnapshotSchema,
  skippedAnswerGenerationSnapshotSchema,
]);

/** 사용자에게 확정된 최종 출력 Snapshot schema입니다. */
const finalOutputSnapshotSchema = z.object({
  type: z.enum(["generated_answer", "no_context"]),
  answer: z.string(),
  usedNoteIds: z.array(z.string()).optional(),
});

/** Note Chat AI Run의 authoritative Snapshot schema입니다. */
export const noteChatSnapshotsSchema = z.object({
  schemaVersion: z.literal(1),
  queryExpansion: queryExpansionSnapshotSchema.optional(),
  retrieval: retrievalSnapshotSchema.optional(),
  answerGeneration: answerGenerationSnapshotSchema.optional(),
  finalOutput: finalOutputSnapshotSchema.optional(),
});

/** 검증된 Note Chat AI Run Snapshot 타입입니다. */
export type NoteChatSnapshots = z.infer<typeof noteChatSnapshotsSchema>;

/** Retrieval 실패 stage 타입입니다. */
export type RetrievalErrorStage = z.infer<typeof retrievalErrorStageSchema>;
