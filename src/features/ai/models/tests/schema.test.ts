import { describe, expect, it } from "vitest";

import {
  AI_MODEL_CAPABILITY,
  AI_MODEL_DISTANCE_METRIC,
  AI_MODEL_PROVIDER,
} from "../../constants/models";
import {
  aiModelCapabilitySchema,
  aiModelConfigRowSchema,
  aiModelDistanceMetricSchema,
  aiModelProviderSchema,
} from "../schema";

const MODEL_ID = "11111111-1111-4111-8111-111111111111";

describe("AI model enum schemas", () => {
  it("지원하는 capability를 허용한다", () => {
    expect(aiModelCapabilitySchema.parse(AI_MODEL_CAPABILITY.CHAT)).toBe(
      AI_MODEL_CAPABILITY.CHAT,
    );
    expect(aiModelCapabilitySchema.parse(AI_MODEL_CAPABILITY.EMBEDDING)).toBe(
      AI_MODEL_CAPABILITY.EMBEDDING,
    );
  });

  it("지원하지 않는 capability를 거부한다", () => {
    expect(aiModelCapabilitySchema.safeParse("image").success).toBe(false);
  });

  it("지원하는 distance metric을 허용한다", () => {
    expect(
      aiModelDistanceMetricSchema.parse(AI_MODEL_DISTANCE_METRIC.COSINE),
    ).toBe(AI_MODEL_DISTANCE_METRIC.COSINE);

    expect(
      aiModelDistanceMetricSchema.parse(AI_MODEL_DISTANCE_METRIC.INNER_PRODUCT),
    ).toBe(AI_MODEL_DISTANCE_METRIC.INNER_PRODUCT);

    expect(aiModelDistanceMetricSchema.parse(AI_MODEL_DISTANCE_METRIC.L2)).toBe(
      AI_MODEL_DISTANCE_METRIC.L2,
    );
  });

  it("지원하지 않는 distance metric을 거부한다", () => {
    expect(aiModelDistanceMetricSchema.safeParse("dot").success).toBe(false);
  });

  it("지원하는 provider를 허용한다", () => {
    expect(aiModelProviderSchema.parse(AI_MODEL_PROVIDER.OPENAI)).toBe(
      AI_MODEL_PROVIDER.OPENAI,
    );
  });

  it("지원하지 않는 provider를 거부한다", () => {
    expect(aiModelProviderSchema.safeParse("anthropic").success).toBe(false);
  });
});

describe("aiModelConfigRowSchema", () => {
  const validRow = {
    capability: AI_MODEL_CAPABILITY.EMBEDDING,
    created_at: "2026-08-04T00:00:00.000Z",
    dimensions: 1536,
    display_name: "OpenAI text-embedding-3-small",
    distance_metric: AI_MODEL_DISTANCE_METRIC.COSINE,
    id: MODEL_ID,
    is_active: true,
    model: "text-embedding-3-small",
    notes: null,
    provider: AI_MODEL_PROVIDER.OPENAI,
    updated_at: "2026-08-04T00:00:00.000Z",
  };

  it("유효한 모델 설정 row를 허용한다", () => {
    expect(aiModelConfigRowSchema.parse(validRow)).toEqual(validRow);
  });

  it("nullable 값을 허용한다", () => {
    expect(
      aiModelConfigRowSchema.parse({
        ...validRow,
        dimensions: null,
        distance_metric: null,
        notes: null,
      }),
    ).toMatchObject({
      dimensions: null,
      distance_metric: null,
      notes: null,
    });
  });

  it("유효하지 않은 UUID를 거부한다", () => {
    expect(
      aiModelConfigRowSchema.safeParse({
        ...validRow,
        id: "invalid-id",
      }).success,
    ).toBe(false);
  });

  it.each([0, -1, 1.5])(
    "유효하지 않은 dimensions %s를 거부한다",
    (dimensions) => {
      expect(
        aiModelConfigRowSchema.safeParse({
          ...validRow,
          dimensions,
        }).success,
      ).toBe(false);
    },
  );

  it.each(["display_name", "model"] as const)(
    "필수 문자열 필드 %s가 비어 있으면 거부한다",
    (field) => {
      expect(
        aiModelConfigRowSchema.safeParse({
          ...validRow,
          [field]: "",
        }).success,
      ).toBe(false);
    },
  );
});
