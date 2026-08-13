import { describe, expect, it } from "vitest";

import { estimateAiUsageCostUsd } from "../pricing";

describe("estimateAiUsageCostUsd", () => {
  it("설정된 Chat 모델의 input/output 비용을 계산한다", () => {
    expect(
      estimateAiUsageCostUsd({
        modelKey: "openai-gpt-4o-mini",
        usage: {
          inputTokens: 1_000_000,
          outputTokens: 1_000_000,
          totalTokens: 2_000_000,
        },
      }),
    ).toEqual({
      inputCostUsd: 0.15,
      outputCostUsd: 0.6,
      totalCostUsd: 0.75,
    });
  });

  it("token 수에 비례하여 소수 단위 비용을 계산한다", () => {
    expect(
      estimateAiUsageCostUsd({
        modelKey: "openai-gpt-4o-mini",
        usage: {
          inputTokens: 500_000,
          outputTokens: 250_000,
          totalTokens: 750_000,
        },
      }),
    ).toEqual({
      inputCostUsd: 0.075,
      outputCostUsd: 0.15,
      totalCostUsd: expect.closeTo(0.225, 10),
    });
  });

  it("Embedding 모델은 input 비용만 계산한다", () => {
    expect(
      estimateAiUsageCostUsd({
        modelKey: "openai-text-embedding-3-small",
        usage: {
          inputTokens: 1_000_000,
          outputTokens: 500_000,
          totalTokens: 1_500_000,
        },
      }),
    ).toEqual({
      inputCostUsd: 0.02,
      outputCostUsd: 0,
      totalCostUsd: 0.02,
    });
  });

  it("등록되지 않은 모델은 비용을 0으로 반환한다", () => {
    expect(
      estimateAiUsageCostUsd({
        modelKey: "custom-model",
        usage: {
          inputTokens: 10,
          outputTokens: 20,
          totalTokens: 30,
        },
      }),
    ).toEqual({
      inputCostUsd: 0,
      outputCostUsd: 0,
      totalCostUsd: 0,
    });
  });
});
