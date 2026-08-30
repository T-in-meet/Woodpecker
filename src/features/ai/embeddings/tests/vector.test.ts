import { describe, expect, it } from "vitest";

import { AI_EMBEDDING_DIMENSIONS } from "../../constants/embeddings";
import { formatAiVectorLiteral, parseAiVectorLiteral } from "../vector";

/** 테스트용 고정 차원 embedding 벡터를 생성합니다. */
function createVector(value: number) {
  return Array.from({ length: AI_EMBEDDING_DIMENSIONS }, () => value);
}

describe("formatAiVectorLiteral", () => {
  it("지원하는 차원의 벡터를 pgvector literal로 변환한다", () => {
    const vector = createVector(0);

    expect(formatAiVectorLiteral(vector)).toBe(`[${vector.join(",")}]`);
  });

  it("지원하는 차원과 다른 벡터를 거부한다", () => {
    expect(() => formatAiVectorLiteral([0.1, 0.2])).toThrow(
      `exactly ${AI_EMBEDDING_DIMENSIONS} dimensions`,
    );
  });

  it("유한하지 않은 숫자가 포함된 벡터를 거부한다", () => {
    const vector = createVector(0);

    vector[0] = Number.NaN;

    expect(() => formatAiVectorLiteral(vector)).toThrow("finite numbers");
  });
});

describe("parseAiVectorLiteral", () => {
  it("pgvector literal을 지원하는 차원의 숫자 배열로 변환한다", () => {
    const vector = createVector(0);
    vector[0] = 0.1;
    vector[1] = -0.2;

    expect(parseAiVectorLiteral(`[${vector.join(",")}]`)).toEqual(vector);
  });

  it("pgvector literal 형식이 아니면 거부한다", () => {
    expect(() => parseAiVectorLiteral("0.1,0.2")).toThrow(
      "AI vector literal has an invalid format.",
    );
  });

  it("지원하는 차원과 다른 vector literal을 거부한다", () => {
    expect(() => parseAiVectorLiteral("[0.1,0.2]")).toThrow(
      `exactly ${AI_EMBEDDING_DIMENSIONS} dimensions`,
    );
  });

  it("유한하지 않은 숫자가 포함된 vector literal을 거부한다", () => {
    const vector = createVector("0" as never).map(String);
    vector[0] = "NaN";

    expect(() => parseAiVectorLiteral(`[${vector.join(",")}]`)).toThrow(
      "finite numbers",
    );
  });
});
