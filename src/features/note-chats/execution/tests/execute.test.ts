import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  AI_MODEL_CAPABILITY,
  AI_MODEL_PROVIDER,
} from "@/features/ai/constants/models";
import type { AiChatStreamEvent } from "@/features/ai/providers/types";

import { executeNoteChat } from "../execute";
import {
  type NoteChatExecutionSettings,
  type PreparedNoteChatExecution,
  prepareNoteChatExecution,
} from "../prepare-execution";
import { startNoteChatProviderStream } from "../start-provider-stream";

vi.mock("../prepare-execution", () => ({
  prepareNoteChatExecution: vi.fn(),
}));

vi.mock("../start-provider-stream", () => ({
  startNoteChatProviderStream: vi.fn(),
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

const PREPARED_EXECUTION: PreparedNoteChatExecution = {
  conversation: {
    id: CONVERSATION_ID,
    user_id: "88888888-8888-4888-8888-888888888888",
    title: "테스트 대화",
    created_at: "2026-08-06T00:00:00.000Z",
    updated_at: "2026-08-06T00:00:00.000Z",
  },
  messages: [],
  referencedNoteIds: [],
  settings: SETTINGS,
  sources: [],
  userMessageId: USER_MESSAGE_ID,
};

const PROVIDER_STREAM = {} as AsyncGenerator<AiChatStreamEvent>;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("executeNoteChat", () => {
  it("실행 정보를 준비하고 Provider 스트림을 생성한다", async () => {
    vi.mocked(prepareNoteChatExecution).mockResolvedValue(PREPARED_EXECUTION);

    vi.mocked(startNoteChatProviderStream).mockReturnValue(PROVIDER_STREAM);

    const result = await executeNoteChat({
      conversationId: CONVERSATION_ID,
      settings: SETTINGS,
      userMessageId: USER_MESSAGE_ID,
    });

    expect(prepareNoteChatExecution).toHaveBeenCalledWith({
      conversationId: CONVERSATION_ID,
      settings: SETTINGS,
      userMessageId: USER_MESSAGE_ID,
    });

    expect(startNoteChatProviderStream).toHaveBeenCalledWith(
      PREPARED_EXECUTION,
    );

    expect(result).toEqual({
      prepared: PREPARED_EXECUTION,
      providerStream: PROVIDER_STREAM,
      referencedNoteIds: PREPARED_EXECUTION.referencedNoteIds,
      sources: PREPARED_EXECUTION.sources,
    });
  });

  it("실행 준비가 실패하면 Provider 스트림을 생성하지 않는다", async () => {
    vi.mocked(prepareNoteChatExecution).mockRejectedValue(
      new Error("Execution preparation failed"),
    );

    await expect(
      executeNoteChat({
        conversationId: CONVERSATION_ID,
        settings: SETTINGS,
        userMessageId: USER_MESSAGE_ID,
      }),
    ).rejects.toThrow("Execution preparation failed");

    expect(startNoteChatProviderStream).not.toHaveBeenCalled();
  });

  it("Provider 스트림 생성 오류를 호출자에게 전달한다", async () => {
    vi.mocked(prepareNoteChatExecution).mockResolvedValue(PREPARED_EXECUTION);

    vi.mocked(startNoteChatProviderStream).mockImplementation(() => {
      throw new Error("Provider stream creation failed");
    });

    await expect(
      executeNoteChat({
        conversationId: CONVERSATION_ID,
        settings: SETTINGS,
        userMessageId: USER_MESSAGE_ID,
      }),
    ).rejects.toThrow("Provider stream creation failed");
  });
});
