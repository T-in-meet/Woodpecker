import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AiChatStreamEvent } from "@/features/ai/providers/types";

import type { NoteChatRunSettings } from "../../schema";
import { executeNoteChat } from "../execute";
import {
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

const SETTINGS: NoteChatRunSettings = {
  agentId: "33333333-3333-4333-8333-333333333333",
  promptVersionId: "44444444-4444-4444-8444-444444444444",
  chatModelConfigId: "55555555-5555-4555-8555-555555555555",
  embeddingModelConfigId: "66666666-6666-4666-8666-666666666666",
};

const PREPARED_EXECUTION: PreparedNoteChatExecution = {
  conversation: {
    id: CONVERSATION_ID,
    user_id: "77777777-7777-4777-8777-777777777777",
    title: "테스트 대화",
    created_at: "2026-08-06T00:00:00.000Z",
    updated_at: "2026-08-06T00:00:00.000Z",
  },
  messages: [],
  settings: {
    prompt: {
      agent: {
        id: SETTINGS.agentId,
        key: "note.chat",
        display_name: "노트 챗봇",
        description: null,
        purpose: "노트 기반 답변 생성",
        tags: [],
        active_prompt_version_id: SETTINGS.promptVersionId,
        is_system_managed: true,
        created_at: "2026-08-06T00:00:00.000Z",
        updated_at: "2026-08-06T00:00:00.000Z",
      },
      family: {
        id: "77777777-7777-4777-8777-777777777777",
        agent_id: SETTINGS.agentId,
        key: "default",
        display_name: "기본 프롬프트",
        description: null,
        tags: [],
        is_system_managed: true,
        created_at: "2026-08-06T00:00:00.000Z",
        updated_at: "2026-08-06T00:00:00.000Z",
      },
      version: {
        id: SETTINGS.promptVersionId,
        family_id: "77777777-7777-4777-8777-777777777777",
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
    chatModel: {
      id: SETTINGS.chatModelConfigId,
      key: "note.chat.model",
      display_name: "노트 챗봇 모델",
      provider: "openai",
      model: "gpt-test",
      capability: "chat",
      dimensions: null,
      distance_metric: null,
      is_active: true,
      is_system_managed: true,
      notes: null,
      created_at: "2026-08-06T00:00:00.000Z",
      updated_at: "2026-08-06T00:00:00.000Z",
    },
    embeddingModel: {
      id: SETTINGS.embeddingModelConfigId,
      key: "note.chat.embedding",
      display_name: "노트 챗봇 임베딩 모델",
      provider: "openai",
      model: "text-embedding-test",
      capability: "embedding",
      dimensions: 1536,
      distance_metric: "cosine",
      is_active: true,
      is_system_managed: true,
      notes: null,
      created_at: "2026-08-06T00:00:00.000Z",
      updated_at: "2026-08-06T00:00:00.000Z",
    },
  },
  referencedNoteIds: [],
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
