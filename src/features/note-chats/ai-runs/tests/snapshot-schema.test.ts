import { describe, expect, it } from "vitest";

import { noteChatSnapshotsSchema } from "../snapshot-schema";

describe("noteChatSnapshotsSchema", () => {
  it("초기 Snapshot을 허용하고 unknown key를 제거한다", () => {
    expect(
      noteChatSnapshotsSchema.parse({
        schemaVersion: 1,
        unknown: "removed",
      }),
    ).toEqual({ schemaVersion: 1 });
  });

  it("no-context 정상 skip과 Final Output을 검증한다", () => {
    expect(
      noteChatSnapshotsSchema.parse({
        answerGeneration: {
          reason: "no_context",
          status: "skipped",
        },
        finalOutput: {
          answer: "참고할 노트가 없습니다.",
          type: "no_context",
          usedNoteIds: [],
        },
        schemaVersion: 1,
      }),
    ).toEqual({
      answerGeneration: {
        reason: "no_context",
        status: "skipped",
      },
      finalOutput: {
        answer: "참고할 노트가 없습니다.",
        type: "no_context",
        usedNoteIds: [],
      },
      schemaVersion: 1,
    });
  });

  it("잘못된 schemaVersion과 음수 Context index를 거부한다", () => {
    expect(() => noteChatSnapshotsSchema.parse({ schemaVersion: 2 })).toThrow();

    expect(() =>
      noteChatSnapshotsSchema.parse({
        answerGeneration: {
          configuration: {
            model: { model: "model", provider: "provider" },
            prompt: { version: {} },
          },
          input: {
            context: "context",
            history: [],
            providerMessages: [],
            question: "question",
          },
          output: {
            parsed: {
              answer: "answer",
              usedContextIndexes: [-1],
            },
            rawResponse: "raw",
          },
          status: "executed",
        },
        schemaVersion: 1,
      }),
    ).toThrow();
  });

  it("Retrieval output에서 selectedCandidateIndexes가 없어도 허용한다", () => {
    expect(
      noteChatSnapshotsSchema.parse({
        retrieval: {
          configuration: {
            embeddingModel: {
              model: "embedding-model",
              provider: "provider",
            },
            search: {
              contextLimit: 5,
              matchLimit: 20,
            },
          },
          input: { inputText: "expanded query" },
          output: {
            context: "context",
            sources: [],
          },
        },
        schemaVersion: 1,
      }),
    ).toEqual({
      retrieval: {
        configuration: {
          embeddingModel: {
            model: "embedding-model",
            provider: "provider",
          },
          search: {
            contextLimit: 5,
            matchLimit: 20,
          },
        },
        input: { inputText: "expanded query" },
        output: {
          context: "context",
          sources: [],
        },
      },
      schemaVersion: 1,
    });
  });

  it("Retrieval의 음수 selectedCandidateIndexes를 거부한다", () => {
    expect(() =>
      noteChatSnapshotsSchema.parse({
        retrieval: {
          configuration: {
            embeddingModel: {
              model: "embedding-model",
              provider: "provider",
            },
            search: {
              contextLimit: 5,
              matchLimit: 20,
            },
          },
          input: { inputText: "expanded query" },
          output: {
            context: "context",
            selectedCandidateIndexes: [-1],
            sources: [],
          },
        },
        schemaVersion: 1,
      }),
    ).toThrow();
  });
});
