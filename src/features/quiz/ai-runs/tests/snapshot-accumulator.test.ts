import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { CloudflareAiError } from "@/lib/ai/client";

import { createQuizSnapshotAccumulator } from "../snapshot-accumulator";

/** accumulator 검증에 사용하는 공통 초기 입력입니다. */
function createAccumulator() {
  return createQuizSnapshotAccumulator({
    action: "regenerate",
    note: {
      id: "11111111-1111-4111-8111-111111111111",
      title: "제목",
      content: "내용",
    },
    quizType: "ox",
    history: [["최근 문제"], ["이전 문제"]],
    previousQuestions: ["최근 문제", "이전 문제"],
  });
}

/** Provider 실행 직전의 공통 preparation 값을 기록합니다. */
function prepareAccumulator() {
  const accumulator = createAccumulator();
  accumulator.recordPreparation({
    title: "제목",
    content: "내용",
    quizType: "ox",
    previousQuestions: ["최근 문제", "이전 문제"],
    maxQuestions: 5,
    perspective: "관점",
    temperature: 0.9,
    prompt: "rendered prompt",
    responseSchema: { type: "object" },
    timeoutMs: 25_000,
    provider: "Cloudflare Workers AI",
    model: "model",
    maxTokens: 8192,
    reasoningEffort: "low",
  });
  return accumulator;
}

describe("createQuizSnapshotAccumulator", () => {
  it("실제 history와 flatten 결과를 포함한 초기 Snapshot을 만든다", () => {
    expect(createAccumulator().buildSnapshot()).toMatchObject({
      sourceInput: { input: { action: "regenerate", quizType: "ox" } },
      generationInput: {
        input: { history: [["최근 문제"], ["이전 문제"]] },
        output: { previousQuestions: ["최근 문제", "이전 문제"] },
      },
    });
  });

  it("Provider와 extraction 관측값을 각각의 stage에 보존한다", () => {
    const accumulator = prepareAccumulator();
    const rawResponse = {
      result: {
        choices: [
          {
            finish_reason: "stop",
            message: { content: '{"questions":[]}' },
          },
        ],
      },
    };

    accumulator.observeGeneration({
      type: "request",
      model: "actual-model",
      body: {
        messages: [{ role: "user", content: "actual prompt" }],
        response_format: {
          type: "json_schema",
          json_schema: { actual: true },
        },
        temperature: 0.8,
        max_tokens: 4096,
        reasoning_effort: "medium",
      },
    });
    accumulator.observeGeneration({
      type: "provider-response",
      response: rawResponse,
      status: 200,
    });
    accumulator.observeGeneration({
      type: "extraction-started",
      result: rawResponse.result,
    });
    accumulator.observeGeneration({
      type: "extraction-completed",
      text: '{"questions":[]}',
    });

    expect(accumulator.buildSnapshot()).toMatchObject({
      quizGeneration: {
        input: {
          prompt: "actual prompt",
          responseSchema: { actual: true },
        },
        configuration: {
          model: "actual-model",
          temperature: 0.8,
          maxTokens: 4096,
          reasoningEffort: "medium",
        },
        output: {
          rawResponse,
          responseText: '{"questions":[]}',
          providerMetadata: { finishReason: "stop" },
        },
      },
      responseExtraction: {
        input: { rawResponse: rawResponse.result },
        output: { responseText: '{"questions":[]}' },
      },
    });
  });

  it("Provider 실패의 안전한 kind, code, status를 기록한다", () => {
    const accumulator = prepareAccumulator();

    accumulator.observeGeneration({
      type: "provider-error",
      error: new CloudflareAiError("provider", 1000, 503),
    });

    expect(accumulator.buildSnapshot()).toMatchObject({
      quizGeneration: {
        error: {
          type: "CloudflareAiError",
          kind: "provider",
          code: 1000,
          status: 503,
        },
      },
    });
  });

  it("validation 실패 시 parsed response와 issues를 함께 보존한다", () => {
    const accumulator = prepareAccumulator();
    const parsedResponse = { questions: [{ type: "ox" }] };

    accumulator.beginParseAndValidation(JSON.stringify(parsedResponse));
    accumulator.recordParsedResponse(parsedResponse);
    accumulator.failParseAndValidation(new Error("validation failed"), [
      { code: "invalid_type" },
    ]);

    expect(accumulator.buildSnapshot()).toMatchObject({
      parseAndValidation: {
        output: { parsedResponse },
        error: {
          message: "validation failed",
          issues: [{ code: "invalid_type" }],
        },
      },
    });
  });

  it("검증된 질문을 parse output과 Final Output에 같은 값으로 기록한다", () => {
    const accumulator = prepareAccumulator();
    const questions = [
      {
        type: "ox" as const,
        question: "질문",
        answer: true,
        explanation: "설명",
      },
    ];

    accumulator.beginParseAndValidation('{"questions":[]}');
    accumulator.recordParsedResponse({ questions });
    accumulator.completeValidation(questions);

    expect(accumulator.buildSnapshot()).toMatchObject({
      parseAndValidation: { output: { validatedQuestions: questions } },
      finalOutput: { questions },
    });
  });
});
