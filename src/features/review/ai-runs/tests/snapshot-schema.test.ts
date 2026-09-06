import { describe, expect, it } from "vitest";

import { reviewGradingSnapshotsSchema } from "../snapshot-schema";

/** 정본 schema 테스트에 사용하는 최소 Source Input Snapshot입니다. */
const SOURCE_INPUT = {
  input: {
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
  },
};

describe("reviewGradingSnapshotsSchema", () => {
  it("실행 전 확보한 Source Input만 있는 초기 Snapshot을 허용한다", () => {
    expect(
      reviewGradingSnapshotsSchema.parse({
        schemaVersion: 1,
        sourceInput: SOURCE_INPUT,
      }),
    ).toEqual({ schemaVersion: 1, sourceInput: SOURCE_INPUT });
  });

  it("Review Log의 필수 source 식별자가 없으면 거부한다", () => {
    const invalid = structuredClone(SOURCE_INPUT);
    Reflect.deleteProperty(invalid.input.reviewLog, "noteId");

    expect(
      reviewGradingSnapshotsSchema.safeParse({
        schemaVersion: 1,
        sourceInput: invalid,
      }).success,
    ).toBe(false);
  });

  it("정규화된 최종 점수가 범위를 벗어나면 거부한다", () => {
    expect(
      reviewGradingSnapshotsSchema.safeParse({
        schemaVersion: 1,
        sourceInput: SOURCE_INPUT,
        finalOutput: {
          grading: {
            score: 101,
            summary: "총평",
            missedConcepts: [],
            incorrectPoints: [],
          },
        },
      }).success,
    ).toBe(false);
  });
});
