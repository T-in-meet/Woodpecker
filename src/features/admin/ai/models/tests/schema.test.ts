import { describe, expect, it } from "vitest";

import {
  adminAiModelConfigOptionRowSchema,
  adminAiModelListRpcRowSchema,
  aiModelConfigRowSchema,
  createModelSchema,
  updateModelSchema,
} from "../schema";

const MODEL_CONFIG_ID = "11111111-1111-4111-8111-111111111111";

describe("createModelSchema", () => {
  const validChatInput = {
    capability: "chat",
    dimensions: "",
    displayName: "GPT-4o",
    distanceMetric: "",
    isActive: true,
    model: "gpt-4o",
    notes: "",
    provider: "openai",
  };

  const validEmbeddingInput = {
    capability: "embedding",
    dimensions: "1536",
    displayName: "Text Embedding 3 Small",
    distanceMetric: "cosine",
    isActive: true,
    model: "text-embedding-3-small",
    notes: "",
    provider: "openai",
  };

  it("Chat 모델 입력을 정리하고 nullable 필드를 변환한다", () => {
    expect(
      createModelSchema.parse({
        ...validChatInput,
        capability: "  chat  ",
        displayName: "  GPT-4o  ",
        model: "  gpt-4o  ",
        provider: "  openai  ",
      }),
    ).toEqual({
      capability: "chat",
      dimensions: null,
      displayName: "GPT-4o",
      distanceMetric: null,
      isActive: true,
      model: "gpt-4o",
      notes: null,
      provider: "openai",
    });
  });

  it("Embedding 모델 입력을 정리하고 변환한다", () => {
    expect(
      createModelSchema.parse({
        ...validEmbeddingInput,
        displayName: "  Text Embedding 3 Small  ",
        notes: "  기본 embedding 모델  ",
      }),
    ).toEqual({
      capability: "embedding",
      dimensions: 1536,
      displayName: "Text Embedding 3 Small",
      distanceMetric: "cosine",
      isActive: true,
      model: "text-embedding-3-small",
      notes: "기본 embedding 모델",
      provider: "openai",
    });
  });

  it.each(["0", "-1", "1.5", "invalid"])(
    "유효하지 않은 dimensions 값 %s를 거부한다",
    (dimensions) => {
      expect(
        createModelSchema.safeParse({
          ...validEmbeddingInput,
          dimensions,
        }).success,
      ).toBe(false);
    },
  );

  it("Embedding 모델의 dimensions가 1536이 아니면 거부한다", () => {
    expect(
      createModelSchema.safeParse({
        ...validEmbeddingInput,
        dimensions: "768",
      }).success,
    ).toBe(false);
  });

  it("Embedding 모델에 distance metric이 없으면 거부한다", () => {
    expect(
      createModelSchema.safeParse({
        ...validEmbeddingInput,
        distanceMetric: "",
      }).success,
    ).toBe(false);
  });

  it.each(["euclidean", "invalid"])(
    "허용되지 않은 distance metric %s를 거부한다",
    (distanceMetric) => {
      expect(
        createModelSchema.safeParse({
          ...validEmbeddingInput,
          distanceMetric,
        }).success,
      ).toBe(false);
    },
  );

  it.each(["cosine", "inner_product", "l2"])(
    "Embedding 모델의 distance metric %s를 허용한다",
    (distanceMetric) => {
      expect(
        createModelSchema.safeParse({
          ...validEmbeddingInput,
          distanceMetric,
        }).success,
      ).toBe(true);
    },
  );

  it("Chat 모델에 dimensions가 있으면 거부한다", () => {
    expect(
      createModelSchema.safeParse({
        ...validChatInput,
        dimensions: "1536",
      }).success,
    ).toBe(false);
  });

  it("Chat 모델에 distance metric이 있으면 거부한다", () => {
    expect(
      createModelSchema.safeParse({
        ...validChatInput,
        distanceMetric: "cosine",
      }).success,
    ).toBe(false);
  });

  it("허용되지 않은 capability를 거부한다", () => {
    expect(
      createModelSchema.safeParse({
        ...validChatInput,
        capability: "invalid",
      }).success,
    ).toBe(false);
  });

  it("허용되지 않은 provider를 거부한다", () => {
    expect(
      createModelSchema.safeParse({
        ...validChatInput,
        provider: "invalid",
      }).success,
    ).toBe(false);
  });

  it("필수 문자열 필드가 비어 있으면 거부한다", () => {
    expect(
      createModelSchema.safeParse({
        ...validChatInput,
        displayName: "   ",
      }).success,
    ).toBe(false);
  });
});

describe("updateModelSchema", () => {
  it("수정 입력을 정리하고 nullable notes를 변환한다", () => {
    expect(
      updateModelSchema.parse({
        displayName: "  GPT-4o Mini  ",
        isActive: false,
        modelConfigId: MODEL_CONFIG_ID,
        notes: "   ",
      }),
    ).toEqual({
      displayName: "GPT-4o Mini",
      isActive: false,
      modelConfigId: MODEL_CONFIG_ID,
      notes: null,
    });
  });

  it("유효하지 않은 model config ID를 거부한다", () => {
    expect(
      updateModelSchema.safeParse({
        displayName: "GPT-4o",
        isActive: true,
        modelConfigId: "invalid-id",
        notes: "",
      }).success,
    ).toBe(false);
  });
});

describe("aiModelConfigRowSchema", () => {
  const validRow = {
    capability: "embedding",
    created_at: "2026-08-03T00:00:00.000Z",
    dimensions: 1536,
    display_name: "OpenAI text embedding 3 small",
    distance_metric: "cosine",
    id: MODEL_CONFIG_ID,
    is_active: true,
    model: "text-embedding-3-small",
    notes: null,
    provider: "openai",
    updated_at: "2026-08-03T01:00:00.000Z",
  };

  it("유효한 model config DB row를 허용한다", () => {
    expect(aiModelConfigRowSchema.parse(validRow)).toEqual(validRow);
  });

  it("nullable 필드의 null 값을 허용한다", () => {
    expect(
      aiModelConfigRowSchema.parse({
        ...validRow,
        dimensions: null,
        distance_metric: null,
      }),
    ).toMatchObject({
      dimensions: null,
      distance_metric: null,
    });
  });

  it("필드 타입이 올바르지 않으면 거부한다", () => {
    expect(
      aiModelConfigRowSchema.safeParse({
        ...validRow,
        is_active: "true",
      }).success,
    ).toBe(false);
  });

  it("Capability 또는 Provider가 올바르지 않으면 거부한다", () => {
    expect(
      aiModelConfigRowSchema.safeParse({
        ...validRow,
        capability: "invalid",
      }).success,
    ).toBe(false);

    expect(
      aiModelConfigRowSchema.safeParse({
        ...validRow,
        provider: "invalid",
      }).success,
    ).toBe(false);
  });
});

describe("adminAiModelListRpcRowSchema", () => {
  const validRow = {
    capability: "chat",
    created_at: "2026-08-03T00:00:00.000Z",
    display_name: "GPT-4o Mini",
    embedding_reference_count: 2,
    id: MODEL_CONFIG_ID,
    is_active: true,
    model: "gpt-4o-mini",
    provider: "openai",
    updated_at: "2026-08-03T01:00:00.000Z",
  };

  it("유효한 모델 목록 RPC row를 허용한다", () => {
    expect(adminAiModelListRpcRowSchema.parse(validRow)).toEqual(validRow);
  });

  it("Capability 또는 Provider가 올바르지 않으면 거부한다", () => {
    expect(
      adminAiModelListRpcRowSchema.safeParse({
        ...validRow,
        capability: "invalid",
      }).success,
    ).toBe(false);

    expect(
      adminAiModelListRpcRowSchema.safeParse({
        ...validRow,
        provider: "invalid",
      }).success,
    ).toBe(false);
  });
});

describe("adminAiModelConfigOptionRowSchema", () => {
  const validRow = {
    capability: "chat",
    display_name: "GPT-4o Mini",
    id: MODEL_CONFIG_ID,
    is_active: true,
    model: "gpt-4o-mini",
    provider: "openai",
  };

  it("유효한 Model 선택 항목 row를 허용한다", () => {
    expect(adminAiModelConfigOptionRowSchema.parse(validRow)).toEqual(validRow);
  });

  it("Capability 또는 Provider가 올바르지 않으면 거부한다", () => {
    expect(
      adminAiModelConfigOptionRowSchema.safeParse({
        ...validRow,
        capability: "invalid",
      }).success,
    ).toBe(false);

    expect(
      adminAiModelConfigOptionRowSchema.safeParse({
        ...validRow,
        provider: "invalid",
      }).success,
    ).toBe(false);
  });
});
