import { describe, expect, it } from "vitest";

import { relatedNotesSnapshotsSchema } from "../snapshot-schema";

const NOTE_ID = "11111111-1111-4111-8111-111111111111";

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
});
