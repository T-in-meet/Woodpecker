import { describe, expect, it } from "vitest";

import { resolveCandidateIndexes } from "../resolve-candidate-indexes";

describe("resolveCandidateIndexes", () => {
  it("선택된 후보를 전체 후보 배열의 index로 변환한다", () => {
    const candidates = [
      { embeddingId: "embedding-a" },
      { embeddingId: "embedding-b" },
      { embeddingId: "embedding-c" },
    ];

    expect(
      resolveCandidateIndexes(candidates, [
        { embeddingId: "embedding-a" },
        { embeddingId: "embedding-c" },
      ]),
    ).toEqual([0, 2]);
  });

  it("선택된 후보가 없으면 빈 배열을 반환한다", () => {
    expect(
      resolveCandidateIndexes([{ embeddingId: "embedding-a" }], []),
    ).toEqual([]);
  });

  it("선택된 후보 중 하나라도 전체 후보에 없으면 null을 반환한다", () => {
    const candidates = [
      { embeddingId: "embedding-a" },
      { embeddingId: "embedding-b" },
    ];

    expect(
      resolveCandidateIndexes(candidates, [
        { embeddingId: "embedding-a" },
        { embeddingId: "embedding-missing" },
      ]),
    ).toBeNull();
  });
});
