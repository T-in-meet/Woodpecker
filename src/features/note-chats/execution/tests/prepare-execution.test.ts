import { beforeEach, describe, expect, it, vi } from "vitest";

import { AI_CHAT_MESSAGE_ROLE } from "@/features/ai/chats/constants";
import {
  AI_MODEL_CAPABILITY,
  AI_MODEL_PROVIDER,
} from "@/features/ai/constants/models";
import { AI_PROVIDER_CHAT_MESSAGE_ROLE } from "@/features/ai/providers/constants";

import { getNoteChatConversationDetail } from "../../queries";
import {
  type NoteChatExecutionSettings,
  prepareNoteChatExecution,
} from "../prepare-execution";
import { resolveNoteChatExecutionMessages } from "../resolve-execution-messages";

vi.mock("../../queries", () => ({
  getNoteChatConversationDetail: vi.fn(),
}));

vi.mock("../resolve-execution-messages", () => ({
  resolveNoteChatExecutionMessages: vi.fn(),
}));

const CONVERSATION_ID = "11111111-1111-4111-8111-111111111111";
const USER_MESSAGE_ID = "22222222-2222-4222-8222-222222222222";

const AGENT_ID = "33333333-3333-4333-8333-333333333333";
const PROMPT_FAMILY_ID = "44444444-4444-4444-8444-444444444444";
const PROMPT_VERSION_ID = "55555555-5555-4555-8555-555555555555";
const CHAT_MODEL_CONFIG_ID = "66666666-6666-4666-8666-666666666666";
const EMBEDDING_MODEL_CONFIG_ID = "77777777-7777-4777-8777-777777777777";

const SETTINGS: NoteChatExecutionSettings = {
  chat: {
    featureKey: "note-chat",
    kind: "chat",
    roleKey: "answer-generation",
    temperature: 0.2,
    prompt: {
      agent: {
        id: AGENT_ID,
        key: "note.chat",
        display_name: "노트 챗봇",
        description: null,
        purpose: "노트 기반 답변 생성",
        tags: [],
        active_prompt_version_id: PROMPT_VERSION_ID,
        is_system_managed: true,
        created_at: "2026-08-06T00:00:00.000Z",
        updated_at: "2026-08-06T00:00:00.000Z",
      },
      family: {
        id: PROMPT_FAMILY_ID,
        agent_id: AGENT_ID,
        key: "default",
        display_name: "기본 프롬프트",
        description: null,
        tags: [],
        is_system_managed: true,
        created_at: "2026-08-06T00:00:00.000Z",
        updated_at: "2026-08-06T00:00:00.000Z",
      },
      version: {
        id: PROMPT_VERSION_ID,
        family_id: PROMPT_FAMILY_ID,
        version_number: 1,
        display_name: "노트 챗봇 v1",
        change_summary: null,
        lifecycle_status: "published",
        system_template: "시스템 템플릿",
        user_template: "{{question}}",
        response_schema: {},
        variables: [],
        tags: [],
        created_by_kind: "system",
        created_by: null,
        is_system_managed: true,
        created_at: "2026-08-06T00:00:00.000Z",
      },
    },
    model: {
      id: CHAT_MODEL_CONFIG_ID,
      key: "note.chat.model",
      display_name: "노트 챗봇 모델",
      provider: AI_MODEL_PROVIDER.OPENAI,
      model: "gpt-test",
      capability: AI_MODEL_CAPABILITY.CHAT,
      dimensions: null,
      distance_metric: null,
      is_active: true,
      is_system_managed: true,
      notes: null,
      created_at: "2026-08-06T00:00:00.000Z",
      updated_at: "2026-08-06T00:00:00.000Z",
    },
  },
  embedding: {
    featureKey: "note-chat",
    kind: "embedding",
    roleKey: "note-retrieval",
    model: {
      id: EMBEDDING_MODEL_CONFIG_ID,
      key: "note.chat.embedding",
      display_name: "노트 챗봇 임베딩 모델",
      provider: AI_MODEL_PROVIDER.OPENAI,
      model: "text-embedding-test",
      capability: AI_MODEL_CAPABILITY.EMBEDDING,
      dimensions: 1536,
      distance_metric: "cosine",
      is_active: true,
      is_system_managed: true,
      notes: null,
      created_at: "2026-08-06T00:00:00.000Z",
      updated_at: "2026-08-06T00:00:00.000Z",
    },
  },
};

const CONVERSATION = {
  id: CONVERSATION_ID,
  user_id: "88888888-8888-4888-8888-888888888888",
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
  it("대화 상세과 Runtime Prompt를 사용해 Provider 실행 정보를 준비한다", async () => {
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

    expect(getNoteChatConversationDetail).toHaveBeenCalledWith(CONVERSATION_ID);

    expect(resolveNoteChatExecutionMessages).toHaveBeenCalledWith({
      messages: DB_MESSAGES,
      systemTemplate: SETTINGS.chat.prompt.version.system_template,
      userMessageId: USER_MESSAGE_ID,
      userTemplate: SETTINGS.chat.prompt.version.user_template,
    });

    expect(result).toEqual({
      conversation: CONVERSATION,
      messages: PROVIDER_MESSAGES,
      referencedNoteIds: [],
      settings: SETTINGS,
      sources: [],
      userMessageId: USER_MESSAGE_ID,
    });
  });

  it("대화를 찾을 수 없으면 오류를 발생시킨다", async () => {
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

  it("Provider 메시지 구성 오류를 호출자에게 전달한다", async () => {
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
