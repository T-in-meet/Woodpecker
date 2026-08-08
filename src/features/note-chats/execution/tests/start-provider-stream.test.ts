import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  AI_MODEL_CAPABILITY,
  AI_MODEL_PROVIDER,
} from "@/features/ai/constants/models";
import { streamAiChatCompletionWithProvider } from "@/features/ai/providers";
import { AI_PROVIDER_CHAT_MESSAGE_ROLE } from "@/features/ai/providers/constants";
import type { AiChatStreamEvent } from "@/features/ai/providers/types";

import type {
  NoteChatExecutionSettings,
  PreparedNoteChatExecution,
} from "../prepare-execution";
import { startNoteChatProviderStream } from "../start-provider-stream";

vi.mock("@/features/ai/providers", () => ({
  streamAiChatCompletionWithProvider: vi.fn(),
}));

const ORIGINAL_OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const ORIGINAL_GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;

const TEMPERATURE = 0.37;

const PROVIDER_MESSAGES = [
  {
    role: AI_PROVIDER_CHAT_MESSAGE_ROLE.SYSTEM,
    content: "시스템 메시지",
  },
  {
    role: AI_PROVIDER_CHAT_MESSAGE_ROLE.USER,
    content: "질문",
  },
];

const PROVIDER_STREAM = {} as AsyncGenerator<AiChatStreamEvent>;

/**
 * 테스트에 사용할 AI Runtime 설정을 생성합니다.
 *
 * @param provider 테스트할 Chat Model Provider
 * @returns Note Chat 실행용 Runtime 설정
 */
function createExecutionSettings(
  provider: typeof AI_MODEL_PROVIDER.OPENAI | typeof AI_MODEL_PROVIDER.GOOGLE,
): NoteChatExecutionSettings {
  return {
    chat: {
      featureKey: "note-chat",
      kind: "chat",
      roleKey: "answer-generation",
      temperature: TEMPERATURE,
      prompt: {
        agent: {
          id: "33333333-3333-4333-8333-333333333333",
          key: "note.chat",
          display_name: "노트 챗봇",
          description: null,
          purpose: "노트 기반 답변 생성",
          tags: [],
          active_prompt_version_id: "55555555-5555-4555-8555-555555555555",
          is_system_managed: true,
          created_at: "2026-08-06T00:00:00.000Z",
          updated_at: "2026-08-06T00:00:00.000Z",
        },
        family: {
          id: "44444444-4444-4444-8444-444444444444",
          agent_id: "33333333-3333-4333-8333-333333333333",
          key: "default",
          display_name: "기본 프롬프트",
          description: null,
          tags: [],
          is_system_managed: true,
          created_at: "2026-08-06T00:00:00.000Z",
          updated_at: "2026-08-06T00:00:00.000Z",
        },
        version: {
          id: "55555555-5555-4555-8555-555555555555",
          family_id: "44444444-4444-4444-8444-444444444444",
          version_number: 1,
          display_name: "노트 챗봇 v1",
          change_summary: null,
          lifecycle_status: "published",
          system_template: "시스템 메시지",
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
        id: "66666666-6666-4666-8666-666666666666",
        key: "note.chat.model",
        display_name: "Note Chat Model",
        provider,
        model:
          provider === AI_MODEL_PROVIDER.OPENAI ? "gpt-test" : "gemini-test",
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
        id: "77777777-7777-4777-8777-777777777777",
        key: "note.chat.embedding",
        display_name: "Note Chat Embedding Model",
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
}

/**
 * 테스트에 사용할 준비된 노트 챗봇 실행 정보를 생성합니다.
 *
 * @param provider 테스트할 AI Provider
 * @returns Provider 호출 직전의 실행 정보
 */
function createPreparedExecution(
  provider: typeof AI_MODEL_PROVIDER.OPENAI | typeof AI_MODEL_PROVIDER.GOOGLE,
): PreparedNoteChatExecution {
  return {
    conversation: {
      id: "11111111-1111-4111-8111-111111111111",
      user_id: "22222222-2222-4222-8222-222222222222",
      title: "테스트 대화",
      created_at: "2026-08-06T00:00:00.000Z",
      updated_at: "2026-08-06T00:00:00.000Z",
    },
    messages: PROVIDER_MESSAGES,
    referencedNoteIds: [],
    settings: createExecutionSettings(provider),
    sources: [],
    userMessageId: "88888888-8888-4888-8888-888888888888",
  };
}

beforeEach(() => {
  vi.clearAllMocks();

  process.env.OPENAI_API_KEY = "test-openai-api-key";
  process.env.GOOGLE_API_KEY = "test-google-api-key";

  vi.mocked(streamAiChatCompletionWithProvider).mockReturnValue(
    PROVIDER_STREAM,
  );
});

afterEach(() => {
  process.env.OPENAI_API_KEY = ORIGINAL_OPENAI_API_KEY;
  process.env.GOOGLE_API_KEY = ORIGINAL_GOOGLE_API_KEY;
});

describe("startNoteChatProviderStream", () => {
  it("OpenAI Runtime 설정과 메시지로 Provider 스트림을 생성한다", () => {
    const prepared = createPreparedExecution(AI_MODEL_PROVIDER.OPENAI);

    const result = startNoteChatProviderStream(prepared);

    expect(streamAiChatCompletionWithProvider).toHaveBeenCalledWith({
      apiKey: "test-openai-api-key",
      messages: PROVIDER_MESSAGES,
      model: "gpt-test",
      provider: AI_MODEL_PROVIDER.OPENAI,
      temperature: TEMPERATURE,
    });

    expect(result).toBe(PROVIDER_STREAM);
  });

  it("Google Runtime 설정과 메시지로 Provider 스트림을 생성한다", () => {
    const prepared = createPreparedExecution(AI_MODEL_PROVIDER.GOOGLE);

    const result = startNoteChatProviderStream(prepared);

    expect(streamAiChatCompletionWithProvider).toHaveBeenCalledWith({
      apiKey: "test-google-api-key",
      messages: PROVIDER_MESSAGES,
      model: "gemini-test",
      provider: AI_MODEL_PROVIDER.GOOGLE,
      temperature: TEMPERATURE,
    });

    expect(result).toBe(PROVIDER_STREAM);
  });

  it("OpenAI API Key가 없으면 오류를 발생시킨다", () => {
    delete process.env.OPENAI_API_KEY;

    expect(() =>
      startNoteChatProviderStream(
        createPreparedExecution(AI_MODEL_PROVIDER.OPENAI),
      ),
    ).toThrow("OPENAI_API_KEY is not configured.");

    expect(streamAiChatCompletionWithProvider).not.toHaveBeenCalled();
  });

  it("Google API Key가 없으면 오류를 발생시킨다", () => {
    delete process.env.GOOGLE_API_KEY;

    expect(() =>
      startNoteChatProviderStream(
        createPreparedExecution(AI_MODEL_PROVIDER.GOOGLE),
      ),
    ).toThrow("GOOGLE_API_KEY is not configured.");

    expect(streamAiChatCompletionWithProvider).not.toHaveBeenCalled();
  });
});
