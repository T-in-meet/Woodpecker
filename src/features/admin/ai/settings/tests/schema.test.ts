import { describe, expect, it } from "vitest";

import {
  adminAiSettingConfigurationsSaveInputSchema,
  adminAiSettingCreateInputSchema,
  adminAiSettingDeleteInputSchema,
  adminAiSettingListBadgeItemSchema,
  adminAiSettingListRowSchema,
  adminAiSettingListRpcResultSchema,
  adminAiSettingUpdateInputSchema,
} from "../schema";

describe("adminAiSettingCreateInputSchema", () => {
  it("유효한 AI 설정 생성 입력값을 허용한다", () => {
    const result = adminAiSettingCreateInputSchema.safeParse({
      displayName: "노트 챗봇",
      key: "note-chat",
      description: "노트 챗봇 설정",
    });

    expect(result.success).toBe(true);
  });

  it("문자열 앞뒤 공백을 제거한다", () => {
    const result = adminAiSettingCreateInputSchema.parse({
      displayName: "  노트 챗봇  ",
      key: "  note-chat  ",
      description: "  설명  ",
    });

    expect(result).toEqual({
      displayName: "노트 챗봇",
      key: "note-chat",
      description: "설명",
    });
  });

  it("빈 displayName을 거부한다", () => {
    const result = adminAiSettingCreateInputSchema.safeParse({
      displayName: "   ",
      key: "note-chat",
      description: "",
    });

    expect(result.success).toBe(false);
  });

  it.each([
    "Note-chat",
    "note_chat",
    "note--chat",
    "-note-chat",
    "note-chat-",
    "note chat",
  ])("허용되지 않는 key 형식을 거부한다: %s", (key) => {
    const result = adminAiSettingCreateInputSchema.safeParse({
      displayName: "노트 챗봇",
      key,
      description: "",
    });

    expect(result.success).toBe(false);
  });

  it.each(["note", "note-chat", "note-chat-v2", "note2-chat3"])(
    "유효한 key 형식을 허용한다: %s",
    (key) => {
      const result = adminAiSettingCreateInputSchema.safeParse({
        displayName: "노트 챗봇",
        key,
        description: "",
      });

      expect(result.success).toBe(true);
    },
  );
});

describe("adminAiSettingUpdateInputSchema", () => {
  it("유효한 AI 설정 수정 입력값을 허용한다", () => {
    const result = adminAiSettingUpdateInputSchema.safeParse({
      settingId: "11111111-1111-4111-8111-111111111111",
      displayName: "수정된 설정",
      description: "수정된 설명",
    });

    expect(result.success).toBe(true);
  });

  it("유효하지 않은 settingId를 거부한다", () => {
    const result = adminAiSettingUpdateInputSchema.safeParse({
      settingId: "invalid",
      displayName: "수정된 설정",
      description: "",
    });

    expect(result.success).toBe(false);
  });

  it("빈 displayName을 거부한다", () => {
    const result = adminAiSettingUpdateInputSchema.safeParse({
      settingId: "11111111-1111-4111-8111-111111111111",
      displayName: "   ",
      description: "",
    });

    expect(result.success).toBe(false);
  });
});

describe("adminAiSettingDeleteInputSchema", () => {
  it("유효한 settingId를 허용한다", () => {
    const result = adminAiSettingDeleteInputSchema.safeParse({
      settingId: "11111111-1111-4111-8111-111111111111",
    });

    expect(result.success).toBe(true);
  });

  it("유효하지 않은 settingId를 거부한다", () => {
    const result = adminAiSettingDeleteInputSchema.safeParse({
      settingId: "invalid",
    });

    expect(result.success).toBe(false);
  });
});

describe("adminAiSettingConfigurationsSaveInputSchema", () => {
  it("Chat 및 Embedding 구성을 함께 허용한다", () => {
    const result = adminAiSettingConfigurationsSaveInputSchema.safeParse({
      settingId: "11111111-1111-4111-8111-111111111111",
      configurations: [
        {
          kind: "chat",
          roleKey: "primary-chat",
          promptVersionId: "22222222-2222-4222-8222-222222222222",
          modelConfigId: "33333333-3333-4333-8333-333333333333",
          temperature: 0.2,
        },
        {
          kind: "embedding",
          roleKey: "primary-embedding",
          modelConfigId: "44444444-4444-4444-8444-444444444444",
        },
      ],
    });

    expect(result.success).toBe(true);
  });

  it("빈 Configuration 목록을 허용한다", () => {
    const result = adminAiSettingConfigurationsSaveInputSchema.safeParse({
      settingId: "11111111-1111-4111-8111-111111111111",
      configurations: [],
    });

    expect(result.success).toBe(true);
  });

  it.each([-0.1, 2.1])(
    "허용 범위를 벗어난 temperature를 거부한다: %s",
    (temperature) => {
      const result = adminAiSettingConfigurationsSaveInputSchema.safeParse({
        settingId: "11111111-1111-4111-8111-111111111111",
        configurations: [
          {
            kind: "chat",
            roleKey: "primary-chat",
            promptVersionId: "22222222-2222-4222-8222-222222222222",
            modelConfigId: "33333333-3333-4333-8333-333333333333",
            temperature,
          },
        ],
      });

      expect(result.success).toBe(false);
    },
  );

  it.each([0, 2])("temperature 경계값을 허용한다: %s", (temperature) => {
    const result = adminAiSettingConfigurationsSaveInputSchema.safeParse({
      settingId: "11111111-1111-4111-8111-111111111111",
      configurations: [
        {
          kind: "chat",
          roleKey: "primary-chat",
          promptVersionId: "22222222-2222-4222-8222-222222222222",
          modelConfigId: "33333333-3333-4333-8333-333333333333",
          temperature,
        },
      ],
    });

    expect(result.success).toBe(true);
  });

  it("Chat 구성의 promptVersionId 누락을 거부한다", () => {
    const result = adminAiSettingConfigurationsSaveInputSchema.safeParse({
      settingId: "11111111-1111-4111-8111-111111111111",
      configurations: [
        {
          kind: "chat",
          roleKey: "primary-chat",
          modelConfigId: "33333333-3333-4333-8333-333333333333",
          temperature: 0.2,
        },
      ],
    });

    expect(result.success).toBe(false);
  });

  it("Configuration roleKey 형식이 올바르지 않으면 거부한다", () => {
    const result = adminAiSettingConfigurationsSaveInputSchema.safeParse({
      settingId: "11111111-1111-4111-8111-111111111111",
      configurations: [
        {
          kind: "embedding",
          roleKey: "Primary Embedding",
          modelConfigId: "33333333-3333-4333-8333-333333333333",
        },
      ],
    });

    expect(result.success).toBe(false);
  });
});

describe("adminAiSettingListBadgeItemSchema", () => {
  it("유효한 목록 배지 항목을 허용한다", () => {
    const result = adminAiSettingListBadgeItemSchema.safeParse({
      id: "11111111-1111-4111-8111-111111111111",
      displayName: "GPT-4o mini",
    });

    expect(result.success).toBe(true);
  });

  it("유효하지 않은 id를 거부한다", () => {
    const result = adminAiSettingListBadgeItemSchema.safeParse({
      id: "invalid",
      displayName: "GPT-4o mini",
    });

    expect(result.success).toBe(false);
  });
});

describe("adminAiSettingListRowSchema", () => {
  const validRow = {
    id: "11111111-1111-4111-8111-111111111111",
    displayName: "노트 챗봇",
    key: "note-chat",
    agents: [
      {
        id: "22222222-2222-4222-8222-222222222222",
        displayName: "Notes RAG Answer",
      },
    ],
    chatModels: [
      {
        id: "33333333-3333-4333-8333-333333333333",
        displayName: "GPT-4o mini",
      },
    ],
    embeddingModels: [
      {
        id: "44444444-4444-4444-8444-444444444444",
        displayName: "text-embedding-3-small",
      },
    ],
    chatConfigurationCount: 1,
    embeddingConfigurationCount: 1,
    createdAt: "2026-08-07T00:00:00.000Z",
    updatedAt: "2026-08-07T01:00:00.000Z",
  };

  it("유효한 AI 설정 목록 row를 허용한다", () => {
    const result = adminAiSettingListRowSchema.safeParse(validRow);

    expect(result.success).toBe(true);
  });

  it("음수 Chat 구성 개수를 거부한다", () => {
    const result = adminAiSettingListRowSchema.safeParse({
      ...validRow,
      chatConfigurationCount: -1,
    });

    expect(result.success).toBe(false);
  });

  it("소수 구성 개수를 거부한다", () => {
    const result = adminAiSettingListRowSchema.safeParse({
      ...validRow,
      embeddingConfigurationCount: 1.5,
    });

    expect(result.success).toBe(false);
  });
});

describe("adminAiSettingListRpcResultSchema", () => {
  it("유효한 RPC 결과를 허용한다", () => {
    const result = adminAiSettingListRpcResultSchema.safeParse({
      items: [],
      total_count: 0,
    });

    expect(result.success).toBe(true);
  });

  it("음수 total_count를 거부한다", () => {
    const result = adminAiSettingListRpcResultSchema.safeParse({
      items: [],
      total_count: -1,
    });

    expect(result.success).toBe(false);
  });
});
