import { describe, expect, it } from "vitest";

import { relatedNotesSnapshotsSchema } from "../snapshot-schema";

const NOTE_ID = "11111111-1111-4111-8111-111111111111";
const MODEL_ID = "22222222-2222-4222-8222-222222222222";

/** 필수 sourceInput만 포함한 partial failed Snapshot fixture입니다. */
function partialSnapshot() {
  return {
    schemaVersion: 1,
    sourceInput: {
      input: {
        note: {
          id: NOTE_ID,
          title: "제목",
          content: "내용",
          updatedAt: "2026-09-05T00:00:00.000Z",
        },
      },
    },
  };
}

/** Answer/Verification stage에서 공통으로 사용하는 Runtime 설정 fixture입니다. */
function chatConfiguration() {
  return {
    model: {
      id: MODEL_ID,
      provider: "openai",
      model: "model",
    },
    prompt: {
      agent: {},
      family: {},
      version: {},
    },
    temperature: 0,
  };
}

describe("relatedNotesSnapshotsSchema", () => {
  it("partial failed Snapshot과 명시적인 skip/final empty output을 허용한다", () => {
    expect(relatedNotesSnapshotsSchema.parse(partialSnapshot())).toEqual(
      partialSnapshot(),
    );
    expect(
      relatedNotesSnapshotsSchema.parse({
        ...partialSnapshot(),
        answerGeneration: { skipped: { reason: "no_candidates" } },
        verification: { skipped: { reason: "no_candidates" } },
        finalOutput: { recommendations: [] },
      }),
    ).toBeDefined();
  });

  it("정의되지 않은 key를 저장 결과에서 제거한다", () => {
    const parsed = relatedNotesSnapshotsSchema.parse({
      ...partialSnapshot(),
      unknownTopLevel: "removed",
      sourceInput: { ...partialSnapshot().sourceInput, unknownStageKey: true },
    });
    expect(parsed).not.toHaveProperty("unknownTopLevel");
    expect(parsed.sourceInput).not.toHaveProperty("unknownStageKey");
  });

  it("sourceInput이 없거나 허용되지 않은 skip reason이면 거부한다", () => {
    expect(() =>
      relatedNotesSnapshotsSchema.parse({ schemaVersion: 1 }),
    ).toThrow();
    expect(() =>
      relatedNotesSnapshotsSchema.parse({
        ...partialSnapshot(),
        verification: { skipped: { reason: "other" } },
      }),
    ).toThrow();
  });

  it("Answer와 Verification의 matched candidate를 index로 허용한다", () => {
    const parsed = relatedNotesSnapshotsSchema.parse({
      ...partialSnapshot(),
      answerGeneration: {
        configuration: chatConfiguration(),
        input: {
          source: {
            title: "제목",
            content: "내용",
          },
          matchedCandidateIndexes: [0, 1, 2],
          context: "answer context",
          variables: {
            title: "제목",
            content: "내용",
            context: "answer context",
          },
          renderedSystemPrompt: "answer system",
          renderedUserPrompt: "answer user",
        },
      },
      verification: {
        configuration: chatConfiguration(),
        input: {
          source: {
            title: "제목",
            content: "내용",
          },
          recommendations: [],
          matchedCandidateIndexes: [0, 1, 2],
          context: "verification context",
          variables: {
            title: "제목",
            content: "내용",
            recommendations: "verification context",
          },
          renderedSystemPrompt: "verification system",
          renderedUserPrompt: "verification user",
        },
      },
    });

    expect(parsed.answerGeneration).toBeDefined();
    expect(parsed.verification).toBeDefined();

    if (
      parsed.answerGeneration === undefined ||
      !("input" in parsed.answerGeneration)
    ) {
      throw new Error("Expected executed Answer Generation snapshot.");
    }

    if (
      parsed.verification === undefined ||
      !("input" in parsed.verification)
    ) {
      throw new Error("Expected executed Verification snapshot.");
    }

    expect(parsed.answerGeneration.input.matchedCandidateIndexes).toEqual([
      0, 1, 2,
    ]);

    expect(parsed.verification.input.matchedCandidateIndexes).toEqual([
      0, 1, 2,
    ]);
  });

  it("음수 matchedCandidateIndexes를 거부한다", () => {
    expect(() =>
      relatedNotesSnapshotsSchema.parse({
        ...partialSnapshot(),
        answerGeneration: {
          configuration: chatConfiguration(),
          input: {
            source: {
              title: "제목",
              content: "내용",
            },
            matchedCandidateIndexes: [-1],
            context: "answer context",
            variables: {
              title: "제목",
              content: "내용",
              context: "answer context",
            },
            renderedSystemPrompt: "answer system",
            renderedUserPrompt: "answer user",
          },
        },
      }),
    ).toThrow();

    expect(() =>
      relatedNotesSnapshotsSchema.parse({
        ...partialSnapshot(),
        verification: {
          configuration: chatConfiguration(),
          input: {
            source: {
              title: "제목",
              content: "내용",
            },
            recommendations: [],
            matchedCandidateIndexes: [-1],
            context: "verification context",
            variables: {
              title: "제목",
              content: "내용",
              recommendations: "verification context",
            },
            renderedSystemPrompt: "verification system",
            renderedUserPrompt: "verification user",
          },
        },
      }),
    ).toThrow();
  });
});
