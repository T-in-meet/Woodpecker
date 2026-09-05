import { createAiRunSnapshotAccumulator } from "@/features/ai/runs/snapshot-accumulator";
import {
  CloudflareAiError,
  type GenerateJsonObservation,
} from "@/lib/ai/client";
import type { QuizType } from "@/lib/ai/prompts";

import type { QuizQuestion } from "../schema";
import {
  type QuizAction,
  type QuizSnapshots,
  quizSnapshotsSchema,
} from "./snapshot-schema";

/** Quiz generation preparation에 실제 사용된 값입니다. */
export type QuizGenerationPreparation = {
  title: string;
  content: string;
  quizType: QuizType;
  previousQuestions: string[];
  maxQuestions: number;
  perspective: string;
  temperature: number;
  prompt: string;
  responseSchema: unknown;
  timeoutMs: number;
  provider: string;
  model: string;
  maxTokens: number;
  reasoningEffort?: string;
};

/** Quiz 실행별 Snapshot accumulator 공개 계약입니다. */
export type QuizSnapshotAccumulator = {
  buildSnapshot: () => unknown;
  recordPreparation: (input: QuizGenerationPreparation) => void;
  observeGeneration: (observation: GenerateJsonObservation) => void;
  beginParseAndValidation: (responseText: string) => void;
  recordParsedResponse: (parsedResponse: unknown) => void;
  failParseAndValidation: (error: unknown, issues?: unknown[]) => void;
  completeValidation: (questions: QuizQuestion[]) => void;
};

/** 오류 값을 정본 Snapshot 오류 형식으로 변환합니다. */
function describeError(error: unknown, issues?: unknown[]) {
  const base =
    error instanceof Error
      ? { type: error.name, message: error.message }
      : { type: "Error", message: "Unknown error" };

  return { ...base, ...(issues === undefined ? {} : { issues }) };
}

/** Cloudflare 응답 result에서 finish reason을 읽습니다. */
function readFinishReason(rawResponse: unknown): string | undefined {
  const result = (rawResponse as { result?: unknown } | null)?.result;
  const finishReason = (
    result as { choices?: Array<{ finish_reason?: unknown }> } | null
  )?.choices?.[0]?.finish_reason;
  return typeof finishReason === "string" ? finishReason : undefined;
}

/** 한 Quiz 생성 실행의 mutable Snapshot accumulator를 생성합니다. */
export function createQuizSnapshotAccumulator(input: {
  action: QuizAction;
  note: { id: string; title: string; content: string };
  quizType: QuizType;
  history: string[][];
  previousQuestions: string[];
}): QuizSnapshotAccumulator {
  const accumulator = createAiRunSnapshotAccumulator<QuizSnapshots>(
    {
      schemaVersion: 1,
      sourceInput: {
        input: {
          action: input.action,
          note: input.note,
          quizType: input.quizType,
        },
      },
      generationInput: {
        input: { history: input.history },
        output: { previousQuestions: input.previousQuestions },
      },
    },
    (state) => quizSnapshotsSchema.parse(state),
  );

  return {
    buildSnapshot: accumulator.buildSnapshot,
    recordPreparation: (preparation) => {
      // 한 번 계산한 preparation 값을 Snapshot과 Provider stage 양쪽에 연결한다.
      accumulator.mutate((state) => {
        state.generationPreparation = {
          input: {
            source: {
              title: preparation.title,
              content: preparation.content,
            },
            quizType: preparation.quizType,
            previousQuestions: preparation.previousQuestions,
          },
          configuration: {
            maxQuestions: preparation.maxQuestions,
            perspective: preparation.perspective,
            temperature: preparation.temperature,
          },
          output: {
            selectedPerspective: preparation.perspective,
            renderedPrompt: preparation.prompt,
            responseSchema: preparation.responseSchema,
          },
        };
        state.quizGeneration = {
          input: {
            prompt: preparation.prompt,
            responseSchema: preparation.responseSchema,
          },
          configuration: {
            provider: preparation.provider,
            model: preparation.model,
            temperature: preparation.temperature,
            maxTokens: preparation.maxTokens,
            ...(preparation.reasoningEffort === undefined
              ? {}
              : { reasoningEffort: preparation.reasoningEffort }),
            responseFormat: {
              type: "json_schema",
              json_schema: preparation.responseSchema,
            },
            timeoutMs: preparation.timeoutMs,
          },
        };
      });
    },
    observeGeneration: (observation) => {
      accumulator.mutate((state) => {
        const generation = state.quizGeneration;
        if (!generation) return;

        if (observation.type === "request") {
          // helper가 실제 fetch body에 넣은 값으로 Provider stage 설정을 확정한다.
          const messages = observation.body.messages;
          const firstMessage = Array.isArray(messages) ? messages[0] : null;
          const prompt = (firstMessage as { content?: unknown } | null)
            ?.content;
          const responseFormat = observation.body.response_format;
          const parsedResponseFormat = responseFormat as
            | { type?: unknown; json_schema?: unknown }
            | undefined;
          const temperature = observation.body.temperature;
          const maxTokens = observation.body.max_tokens;
          const reasoningEffort = observation.body.reasoning_effort;

          generation.configuration.model = observation.model;
          if (typeof prompt === "string") {
            generation.input.prompt = prompt;
          }
          if (
            parsedResponseFormat?.type === "json_schema" &&
            "json_schema" in parsedResponseFormat
          ) {
            generation.input.responseSchema = parsedResponseFormat.json_schema;
            generation.configuration.responseFormat = {
              type: "json_schema",
              json_schema: parsedResponseFormat.json_schema,
            };
          }
          if (typeof temperature === "number") {
            generation.configuration.temperature = temperature;
          }
          if (
            typeof maxTokens === "number" &&
            Number.isInteger(maxTokens) &&
            maxTokens > 0
          ) {
            generation.configuration.maxTokens = maxTokens;
          }
          if (typeof reasoningEffort === "string") {
            generation.configuration.reasoningEffort = reasoningEffort;
          }
          return;
        }

        if (observation.type === "provider-response") {
          const finishReason = readFinishReason(observation.response);
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
            ...(observation.error instanceof CloudflareAiError
              ? {
                  kind: observation.error.kind,
                  ...(observation.error.code === undefined
                    ? {}
                    : { code: observation.error.code }),
                  ...(observation.error.status === undefined
                    ? {}
                    : { status: observation.error.status }),
                }
              : {}),
          };
          return;
        }

        if (observation.type === "extraction-started") {
          state.responseExtraction = {
            input: { rawResponse: observation.result },
          };
          return;
        }

        if (observation.type === "extraction-completed") {
          generation.output = {
            ...generation.output,
            responseText: observation.text,
          };
          if (state.responseExtraction) {
            state.responseExtraction.output = {
              responseText: observation.text,
            };
          }
          return;
        }

        if (state.responseExtraction) {
          state.responseExtraction.error = describeError(observation.error);
        }
      });
    },
    beginParseAndValidation: (responseText) => {
      accumulator.mutate((state) => {
        state.parseAndValidation = {
          input: { responseText },
          configuration: { quizType: input.quizType },
        };
      });
    },
    recordParsedResponse: (parsedResponse) => {
      accumulator.mutate((state) => {
        if (!state.parseAndValidation) return;
        state.parseAndValidation.output = { parsedResponse };
      });
    },
    failParseAndValidation: (error, issues) => {
      accumulator.mutate((state) => {
        if (!state.parseAndValidation) return;
        state.parseAndValidation.error = describeError(error, issues);
      });
    },
    completeValidation: (questions) => {
      accumulator.mutate((state) => {
        if (!state.parseAndValidation) return;
        state.parseAndValidation.output = {
          ...state.parseAndValidation.output,
          validatedQuestions: questions,
        };
        state.finalOutput = { questions };
      });
    },
  };
}
