import { beforeEach, describe, expect, it, vi } from "vitest";

import { AI_CHAT_MESSAGE_ROLE } from "@/features/ai/chats/constants";
import { AI_PROVIDER_CHAT_MESSAGE_ROLE } from "@/features/ai/providers/constants";

import { getNoteChatConversationDetail } from "../../queries";
import type { NoteChatRunSettings } from "../../schema";
import { prepareNoteChatExecution } from "../prepare-execution";
import { resolveNoteChatExecutionMessages } from "../resolve-execution-messages";
import { resolveNoteChatExecutionSettings } from "../resolve-settings";

vi.mock("../../queries", () => ({
  getNoteChatConversationDetail: vi.fn(),
}));

vi.mock("../resolve-settings", () => ({
  resolveNoteChatExecutionSettings: vi.fn(),
}));

vi.mock("../resolve-execution-messages", () => ({
  resolveNoteChatExecutionMessages: vi.fn(),
}));

const CONVERSATION_ID = "11111111-1111-4111-8111-111111111111";
const USER_MESSAGE_ID = "22222222-2222-4222-8222-222222222222";

const SETTINGS: NoteChatRunSettings = {
  agentId: "33333333-3333-4333-8333-333333333333",
  promptVersionId: "44444444-4444-4444-8444-444444444444",
  chatModelConfigId: "55555555-5555-4555-8555-555555555555",
  embeddingModelConfigId: "66666666-6666-4666-8666-666666666666",
};

const CONVERSATION = {
  id: CONVERSATION_ID,
  user_id: "77777777-7777-4777-8777-777777777777",
  title: "테스트 대화",
  created_at: "2026-08-06T00:00:00.000Z",
  updated_at: "2026-08-06T00:00:00.000Z",
};

const DB_MESSAGES = [
  {
    id: USER_MESSAGE_ID,
    conversation_id: CONVERSATION_ID,
    role: AI_CHAT_MESSAGE_ROLE.USER,
    content: {
      text: "현재 질문",
    },
    sequence_number: 1,
    created_at: "2026-08-06T00:00:00.000Z",
    updated_at: "2026-08-06T00:00:00.000Z",
  },
];

const RESOLVED_SETTINGS = {
  prompt: {
    agent: {
      id: SETTINGS.agentId,
    },
    family: {
      id: "88888888-8888-4888-8888-888888888888",
    },
    version: {
      id: SETTINGS.promptVersionId,
      system_template: "시스템 템플릿",
      user_template: "{{question}}",
    },
  },
  chatModel: {
    id: SETTINGS.chatModelConfigId,
  },
  embeddingModel: {
    id: SETTINGS.embeddingModelConfigId,
  },
};

const PROVIDER_MESSAGES = [
  {
    role: AI_PROVIDER_CHAT_MESSAGE_ROLE.SYSTEM,
    content: "시스템 템플릿",
  },
  {
    role: AI_PROVIDER_CHAT_MESSAGE_ROLE.USER,
    content: "현재 질문",
  },
];

beforeEach(() => {
  vi.clearAllMocks();
});

describe("prepareNoteChatExecution", () => {
  it("설정과 대화 상세를 조회하고 Provider 메시지를 준비한다", async () => {
    vi.mocked(resolveNoteChatExecutionSettings).mockResolvedValue(
      RESOLVED_SETTINGS as never,
    );

    vi.mocked(getNoteChatConversationDetail).mockResolvedValue({
      conversation: CONVERSATION,
      messages: DB_MESSAGES,
    } as never);

    vi.mocked(resolveNoteChatExecutionMessages).mockReturnValue(
      PROVIDER_MESSAGES,
    );

    const result = await prepareNoteChatExecution({
      conversationId: CONVERSATION_ID,
      settings: SETTINGS,
      userMessageId: USER_MESSAGE_ID,
    });

    expect(resolveNoteChatExecutionSettings).toHaveBeenCalledWith(SETTINGS);

    expect(getNoteChatConversationDetail).toHaveBeenCalledWith(CONVERSATION_ID);

    expect(resolveNoteChatExecutionMessages).toHaveBeenCalledWith({
      messages: DB_MESSAGES,
      systemTemplate: "시스템 템플릿",
      userMessageId: USER_MESSAGE_ID,
      userTemplate: "{{question}}",
    });

    expect(result).toEqual({
      conversation: CONVERSATION,
      messages: PROVIDER_MESSAGES,
      settings: RESOLVED_SETTINGS,
      userMessageId: USER_MESSAGE_ID,
    });
  });

  it("대화를 찾을 수 없으면 오류를 발생시킨다", async () => {
    vi.mocked(resolveNoteChatExecutionSettings).mockResolvedValue(
      RESOLVED_SETTINGS as never,
    );

    vi.mocked(getNoteChatConversationDetail).mockResolvedValue(null);

    await expect(
      prepareNoteChatExecution({
        conversationId: CONVERSATION_ID,
        settings: SETTINGS,
        userMessageId: USER_MESSAGE_ID,
      }),
    ).rejects.toThrow(`Note chat conversation not found: ${CONVERSATION_ID}`);

    expect(resolveNoteChatExecutionMessages).not.toHaveBeenCalled();
  });

  it("실행 설정 조회 오류를 호출자에게 전달한다", async () => {
    vi.mocked(resolveNoteChatExecutionSettings).mockRejectedValue(
      new Error("Settings resolution failed"),
    );

    vi.mocked(getNoteChatConversationDetail).mockResolvedValue({
      conversation: CONVERSATION,
      messages: DB_MESSAGES,
    } as never);

    await expect(
      prepareNoteChatExecution({
        conversationId: CONVERSATION_ID,
        settings: SETTINGS,
        userMessageId: USER_MESSAGE_ID,
      }),
    ).rejects.toThrow("Settings resolution failed");
  });

  it("Provider 메시지 구성 오류를 호출자에게 전달한다", async () => {
    vi.mocked(resolveNoteChatExecutionSettings).mockResolvedValue(
      RESOLVED_SETTINGS as never,
    );

    vi.mocked(getNoteChatConversationDetail).mockResolvedValue({
      conversation: CONVERSATION,
      messages: DB_MESSAGES,
    } as never);

    vi.mocked(resolveNoteChatExecutionMessages).mockImplementation(() => {
      throw new Error("Message resolution failed");
    });

    await expect(
      prepareNoteChatExecution({
        conversationId: CONVERSATION_ID,
        settings: SETTINGS,
        userMessageId: USER_MESSAGE_ID,
      }),
    ).rejects.toThrow("Message resolution failed");
  });
});
