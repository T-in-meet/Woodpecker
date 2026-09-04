import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { CloudflareAiError } from "@/lib/ai/client";

import { createReviewGradingSnapshotAccumulator } from "../snapshot-accumulator";

/** accumulator 테스트에서 공유하는 실제 실행 Source Input입니다. */
const SOURCE_INPUT = {
  note: {
    id: "11111111-1111-4111-8111-111111111111",
    content: "실제 채점 본문",
  },
  reviewLog: {
    id: "22222222-2222-4222-8222-222222222222",
    noteId: "11111111-1111-4111-8111-111111111111",
    round: 2,
    scheduledAt: "2026-09-04T00:00:00.000Z",
    completedAt: null,
  },
  answer: "사용자 답안",
  originalContentHash: "original-hash",
  currentContentHash: "current-hash",
};

/** 성공 단계 테스트에 사용하는 검증된 grading입니다. */
const GRADING = {
  score: 80,
  summary: "잘 기억했습니다.",
  missedConcepts: ["누락 1"],
  incorrectPoints: [],
};

describe("createReviewGradingSnapshotAccumulator", () => {
  it("실제 preparation, Provider, extraction, parse와 최종 출력을 순서대로 누적한다", () => {
    const accumulator = createReviewGradingSnapshotAccumulator(SOURCE_INPUT);
    const responseSchema = { type: "object", required: ["score"] };
    const providerResult = {
      choices: [
        {
          finish_reason: "stop",
          message: { content: JSON.stringify(GRADING) },
        },
      ],
    };
    const providerResponse = { success: true, result: providerResult };

    accumulator.prepareGrading({
      originalContent: SOURCE_INPUT.note.content,
      userAnswer: SOURCE_INPUT.answer,
      renderedPrompt: "실제 prompt",
      responseSchema,
    });
    accumulator.prepareGeneration({
      prompt: "실제 prompt",
      responseSchema,
      timeoutMs: 42_000,
    });
    accumulator.observeGeneration({
      type: "request",
      model: "@cf/openai/gpt-oss-120b",
      body: {
        messages: [{ role: "user", content: "실제 prompt" }],
        response_format: { type: "json_schema", json_schema: responseSchema },
        max_tokens: 8192,
        reasoning_effort: "low",
      },
    });
    accumulator.observeGeneration({
      type: "provider-response",
      response: providerResponse,
      status: 200,
    });
    accumulator.observeGeneration({
      type: "extraction-started",
      result: providerResult,
    });
    accumulator.observeGeneration({
      type: "extraction-completed",
      text: JSON.stringify(GRADING),
    });
    accumulator.startParseAndValidation({
      responseText: JSON.stringify(GRADING),
      validationSchema: responseSchema,
    });
    accumulator.completeJsonParse(GRADING);
    accumulator.completeValidation(GRADING);
    accumulator.completeNormalization(GRADING, GRADING);
    accumulator.completeFinalOutput(GRADING);

    expect(accumulator.buildSnapshot()).toMatchObject({
      sourceInput: { input: SOURCE_INPUT },
      gradingPreparation: {
        output: { renderedPrompt: "실제 prompt", responseSchema },
      },
      gradingGeneration: {
        input: {
          messages: [{ role: "user", content: "실제 prompt" }],
          responseSchema,
        },
        configuration: { timeoutMs: 42_000 },
        output: { rawResponse: providerResponse },
      },
      responseExtraction: {
        input: { providerResult },
        output: {
          responseText: JSON.stringify(GRADING),
          providerMetadata: { finishReason: "stop" },
        },
      },
      parseAndValidation: {
        output: { parsedResponse: GRADING, validatedGrading: GRADING },
      },
      normalization: {
        input: { grading: GRADING },
        output: { grading: GRADING },
      },
      finalOutput: { grading: GRADING },
    });
  });

  it("Provider 실패의 kind, code와 status를 partial Snapshot에 남긴다", () => {
    const accumulator = createReviewGradingSnapshotAccumulator(SOURCE_INPUT);

    accumulator.prepareGeneration({
      prompt: "실제 prompt",
      responseSchema: { type: "object" },
      timeoutMs: 30_000,
    });
    accumulator.observeGeneration({
      type: "provider-error",
      error: new CloudflareAiError("provider", 1001, 503),
    });

    expect(accumulator.buildSnapshot()).toMatchObject({
      gradingGeneration: {
        error: {
          type: "CloudflareAiError",
          kind: "provider",
          code: 1001,
          status: 503,
        },
      },
    });
  });

  it("schema validation 실패 시 parsed response와 issues를 함께 남긴다", () => {
    const accumulator = createReviewGradingSnapshotAccumulator(SOURCE_INPUT);
    const parsedResponse = { score: 200 };
    const issues = [{ code: "too_big", path: ["score"] }];

    accumulator.startParseAndValidation({
      responseText: JSON.stringify(parsedResponse),
      validationSchema: { type: "object" },
    });
    accumulator.completeJsonParse(parsedResponse);
    accumulator.failValidation(issues);

    expect(accumulator.buildSnapshot()).toMatchObject({
      parseAndValidation: {
        output: { parsedResponse },
        error: { type: "ZodError", issues },
      },
    });
  });
});
