import { describe, expect, it } from "vitest";

import { createNoteChatSnapshotAccumulator } from "../snapshot-accumulator";

describe("createNoteChatSnapshotAccumulator", () => {
  it("초기 상태와 no-context 최종 결과를 전체 문서로 build한다", () => {
    const accumulator = createNoteChatSnapshotAccumulator();

    expect(accumulator.buildSnapshot()).toEqual({ schemaVersion: 1 });

    accumulator.completeNoContextAnswer("참고할 노트가 없습니다.");

    expect(accumulator.buildSnapshot()).toEqual({
      answerGeneration: { reason: "no_context", status: "skipped" },
      finalOutput: {
        answer: "참고할 노트가 없습니다.",
        type: "no_context",
        usedNoteIds: [],
      },
      schemaVersion: 1,
    });
  });

  it("Query Expansion 실패 시 확보한 원문과 오류를 보존한다", () => {
    const accumulator = createNoteChatSnapshotAccumulator();
    const error = new Error("validation failed");

    accumulator.prepareQueryExpansion({ history: [], question: "질문" });
    accumulator.observeQueryExpansion({
      configuration: {
        model: { id: "model-id", model: "model", provider: "openai" },
        prompt: {
          agent: { id: "agent-id" },
          family: { id: "family-id" },
          version: { id: "version-id" },
        },
        temperature: 0,
      } as never,
      responseFormat: undefined,
      systemPrompt: "system",
      type: "prepared",
      userPrompt: "user",
      variables: { question: "질문" },
    });
    accumulator.observeQueryExpansion({
      result: {
        content: "raw response",
        metadata: {},
        usage: { inputTokens: 1, outputTokens: 2, totalTokens: 3 },
      },
      type: "completed",
    });
    accumulator.failQueryExpansion(error, [{ code: "invalid" }]);

    expect(accumulator.buildSnapshot()).toMatchObject({
      queryExpansion: {
        error: {
          message: "validation failed",
          rawResponse: "raw response",
          validationIssues: [{ code: "invalid" }],
        },
        output: { rawResponse: "raw response" },
      },
    });
  });
});
