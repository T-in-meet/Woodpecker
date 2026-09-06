import { createAiRunSnapshotAccumulator } from "@/features/ai/runs/snapshot-accumulator";
import {
  CLOUDFLARE_JSON_GENERATION_CONFIG,
  type GenerateJsonObservation,
} from "@/lib/ai/client";

import { FEEDBACK_ITEMS_MAX, type GradingResponse } from "../schema";
import {
  type ReviewGradingSnapshots,
  reviewGradingSnapshotsSchema,
} from "./snapshot-schema";

/** Review Grading Snapshot 최초 생성에 필요한 실제 실행 입력입니다. */
export type ReviewGradingSourceInput = {
  note: { id: string; content: string };
  reviewLog: {
    id: string;
    noteId: string;
    round: number;
    scheduledAt: string;
    completedAt: string | null;
  };
  answer: string;
  originalContentHash: string;
  currentContentHash: string;
};

/** Review Grading 실행별 Snapshot accumulator 공개 계약입니다. */
export type ReviewGradingSnapshotAccumulator = {
  buildSnapshot: () => unknown;
  prepareGeneration: (input: {
    prompt: string;
    responseSchema: unknown;
    timeoutMs: number;
  }) => void;
  observeGeneration: (observation: GenerateJsonObservation) => void;
  startParseAndValidation: (input: { validationSchema: unknown }) => void;
  failJsonParse: (error: unknown) => void;
  completeValidation: (grading: GradingResponse) => void;
  failValidation: (issues: unknown[]) => void;
  completeNormalization: () => void;
  completeFinalOutput: (grading: GradingResponse) => void;
};

/** 알 수 있는 오류 값을 민감 원문 없이 공통 Snapshot 형태로 변환합니다. */
function describeError(error: unknown): { type: string; message: string } {
  if (error instanceof Error) {
    return { type: error.name, message: error.message };
  }

  return { type: "UnknownError", message: "Unknown error" };
}

/** Provider result에서 첫 choice의 finish_reason을 읽습니다. */
function readFinishReason(result: unknown): string | undefined {
  if (result === null || typeof result !== "object") return undefined;

  const choices = (result as { choices?: unknown }).choices;
  if (!Array.isArray(choices) || choices.length === 0) return undefined;

  const first: unknown = choices[0];
  if (first === null || typeof first !== "object") return undefined;

  const finishReason = (first as { finish_reason?: unknown }).finish_reason;
  return typeof finishReason === "string" ? finishReason : undefined;
}

/** Provider request body의 messages를 Snapshot 계약으로 좁힙니다. */
function readProviderMessages(
  body: Record<string, unknown>,
): Array<{ role: string; content: string }> {
  const messages = body.messages;
  if (!Array.isArray(messages)) return [];

  return messages.flatMap((message) => {
    if (message === null || typeof message !== "object") return [];

    const role = (message as { role?: unknown }).role;
    const content = (message as { content?: unknown }).content;
    return typeof role === "string" && typeof content === "string"
      ? [{ role, content }]
      : [];
  });
}

/** 한 Review Grading AI 실행의 mutable Snapshot accumulator를 생성합니다. */
export function createReviewGradingSnapshotAccumulator(
  sourceInput: ReviewGradingSourceInput,
): ReviewGradingSnapshotAccumulator {
  // 초기 create 경계에는 추가 계산 없이 이미 확보된 실제 입력만 보존한다.
  const accumulator = createAiRunSnapshotAccumulator<ReviewGradingSnapshots>(
    {
      schemaVersion: 1,
      sourceInput: { input: sourceInput },
    },
    (state) => reviewGradingSnapshotsSchema.parse(state),
  );

  return {
    buildSnapshot: accumulator.buildSnapshot,
    prepareGeneration: (input) => {
      accumulator.mutate((state) => {
        state.gradingGeneration = {
          input: {
            messages: [{ role: "user", content: input.prompt }],
          },
          configuration: {
            provider: CLOUDFLARE_JSON_GENERATION_CONFIG.provider,
            model: CLOUDFLARE_JSON_GENERATION_CONFIG.model,
            maxTokens: CLOUDFLARE_JSON_GENERATION_CONFIG.maxTokens,
            reasoningEffort: CLOUDFLARE_JSON_GENERATION_CONFIG.reasoningEffort,
            responseFormat: {
              type: "json_schema",
              json_schema: input.responseSchema,
            },
            timeoutMs: input.timeoutMs,
          },
        };
      });
    },
    observeGeneration: (observation) => {
      accumulator.mutate((state) => {
        const generation = state.gradingGeneration;
        if (!generation) return;

        if (observation.type === "request") {
          // 공통 client가 실제 fetch에 사용한 body로 준비값을 확정한다.
          generation.input = {
            messages: readProviderMessages(observation.body),
          };
          generation.configuration = {
            ...generation.configuration,
            model: observation.model,
            maxTokens:
              typeof observation.body.max_tokens === "number"
                ? observation.body.max_tokens
                : 0,
            ...(typeof observation.body.reasoning_effort === "string"
              ? { reasoningEffort: observation.body.reasoning_effort }
              : {}),
            responseFormat: observation.body.response_format,
            ...(typeof observation.body.temperature === "number"
              ? { temperature: observation.body.temperature }
              : {}),
          };
          return;
        }

        if (observation.type === "provider-response") {
          const result = (observation.response as { result?: unknown } | null)
            ?.result;
          const finishReason = readFinishReason(result);

          generation.output = {
            rawResponse: observation.response,
            ...(finishReason === undefined
              ? {}
              : { providerMetadata: { finishReason } }),
          };
          return;
        }

        if (observation.type === "provider-error") {
          generation.error = {
            ...describeError(observation.error),
            kind: observation.error.kind,
            ...(observation.error.code === undefined
              ? {}
              : { code: observation.error.code }),
            ...(observation.error.status === undefined
              ? {}
              : { status: observation.error.status }),
          };
          return;
        }

        if (observation.type === "extraction-started") {
          state.responseExtraction = {};
          return;
        }

        const extraction = state.responseExtraction;
        if (!extraction) return;

        if (observation.type === "extraction-completed") {
          extraction.output = {
            responseText: observation.text,
          };
          return;
        }

        extraction.error = describeError(observation.error);
      });
    },
    startParseAndValidation: (input) => {
      accumulator.mutate((state) => {
        state.parseAndValidation = {
          configuration: { validationSchema: input.validationSchema },
        };
      });
    },
    failJsonParse: (error) => {
      accumulator.mutate((state) => {
        if (!state.parseAndValidation) return;
        state.parseAndValidation.error = describeError(error);
      });
    },
    completeValidation: (grading) => {
      accumulator.mutate((state) => {
        if (!state.parseAndValidation) return;
        state.parseAndValidation.output = {
          validatedGrading: grading,
        };
      });
    },
    failValidation: (issues) => {
      accumulator.mutate((state) => {
        if (!state.parseAndValidation) return;
        state.parseAndValidation.error = {
          type: "ZodError",
          message: "Review grading response validation failed",
          issues,
        };
      });
    },
    completeNormalization: () => {
      accumulator.mutate((state) => {
        state.normalization = {
          configuration: { feedbackItemsMax: FEEDBACK_ITEMS_MAX },
        };
      });
    },
    completeFinalOutput: (grading) => {
      accumulator.mutate((state) => {
        state.finalOutput = { grading };
      });
    },
  };
}
