import { beforeEach, describe, expect, it, vi } from "vitest";

import { runNoteChatStream } from "@/features/note-chats/stream/run-note-chat-stream";
import { createClient } from "@/lib/supabase/server";

import { POST } from "./route";

const runtimeMocks = vi.hoisted(() => ({
  resolveAiRuntimeChatConfiguration: vi.fn(),
  resolveAiRuntimeEmbeddingConfiguration: vi.fn(),
}));

vi.mock("@/features/ai/runtimes/resolve-configuration", () => ({
  resolveAiRuntimeChatConfiguration:
    runtimeMocks.resolveAiRuntimeChatConfiguration,
  resolveAiRuntimeEmbeddingConfiguration:
    runtimeMocks.resolveAiRuntimeEmbeddingConfiguration,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/features/note-chats/stream/run-note-chat-stream", () => ({
  runNoteChatStream: vi.fn(),
}));

const CONVERSATION_ID = "11111111-1111-4111-8111-111111111111";
const USER_MESSAGE_ID = "22222222-2222-4222-8222-222222222222";
const RUN_ID = "33333333-3333-4333-8333-333333333333";

const AGENT_ID = "44444444-4444-4444-8444-444444444444";
const PROMPT_FAMILY_ID = "55555555-5555-4555-8555-555555555555";
const PROMPT_VERSION_ID = "66666666-6666-4666-8666-666666666666";
const CHAT_MODEL_CONFIG_ID = "77777777-7777-4777-8777-777777777777";
const EMBEDDING_MODEL_CONFIG_ID = "88888888-8888-4888-8888-888888888888";

const VALID_INPUT = {
  conversationId: CONVERSATION_ID,
  content: {
    text: "질문입니다.",
  },
};

const CHAT_CONFIGURATION = {
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
};

const EMBEDDING_CONFIGURATION = {
  featureKey: "note-chat",
  kind: "embedding",
  roleKey: "note-retrieval",

  model: {
    id: EMBEDDING_MODEL_CONFIG_ID,
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
};

const EXECUTION_SETTINGS = {
  chat: CHAT_CONFIGURATION,
  embedding: EMBEDDING_CONFIGURATION,
};

/**
 * Route Handler 테스트용 Supabase Client Mock을 생성합니다.
 *
 * @param params 인증 사용자와 질문 생성 RPC 결과
 * @returns Route Handler에 주입할 Supabase Client Mock
 */
function createSupabaseClientMock(params: {
  user: {
    id: string;
    email_confirmed_at: string | null;
  } | null;
  userError?: { message: string } | null;
  rpcData?: {
    run_id: string;
    user_message_id: string;
  } | null;
  rpcError?: { message: string } | null;
}) {
  const single = vi.fn().mockResolvedValue({
    data: params.rpcData ?? null,
    error: params.rpcError ?? null,
  });

  const rpc = vi.fn().mockReturnValue({
    single,
  });

  const getUser = vi.fn().mockResolvedValue({
    data: {
      user: params.user,
    },
    error: params.userError ?? null,
  });

  return {
    auth: {
      getUser,
    },
    rpc,
  };
}

/**
 * JSON 요청 객체를 생성합니다.
 *
 * @param body 요청 본문
 * @returns Route Handler에 전달할 Request
 */
function createJsonRequest(body: unknown): Request {
  return new Request("http://localhost/api/note-chats/stream", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

/**
 * NDJSON 응답을 이벤트 배열로 변환합니다.
 *
 * @param response Route Handler 스트림 응답
 * @returns 스트림에 포함된 이벤트 목록
 */
async function readNdjsonEvents(response: Response): Promise<unknown[]> {
  const text = await response.text();

  return text
    .split("\n")
    .filter((line) => line.length > 0)
    .map((line) => JSON.parse(line) as unknown);
}

beforeEach(() => {
  vi.clearAllMocks();

  runtimeMocks.resolveAiRuntimeChatConfiguration.mockResolvedValue(
    CHAT_CONFIGURATION,
  );

  runtimeMocks.resolveAiRuntimeEmbeddingConfiguration.mockResolvedValue(
    EMBEDDING_CONFIGURATION,
  );
});

describe("POST /api/note-chats/stream", () => {
  it("올바르지 않은 JSON 요청은 400을 반환한다", async () => {
    const request = new Request("http://localhost/api/note-chats/stream", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: "{invalid-json",
    });

    const response = await POST(request);

    expect(response.status).toBe(400);

    await expect(response.json()).resolves.toEqual({
      error: "요청 본문이 올바른 JSON 형식이 아닙니다.",
    });

    expect(createClient).not.toHaveBeenCalled();
    expect(
      runtimeMocks.resolveAiRuntimeChatConfiguration,
    ).not.toHaveBeenCalled();
  });

  it("스키마 검증에 실패하면 400을 반환한다", async () => {
    const response = await POST(
      createJsonRequest({
        ...VALID_INPUT,
        conversationId: "invalid-id",
      }),
    );

    expect(response.status).toBe(400);

    await expect(response.json()).resolves.toEqual({
      error: "올바른 대화 ID가 아닙니다.",
    });

    expect(createClient).not.toHaveBeenCalled();
    expect(
      runtimeMocks.resolveAiRuntimeChatConfiguration,
    ).not.toHaveBeenCalled();
  });

  it("로그인하지 않은 사용자는 401을 반환한다", async () => {
    vi.mocked(createClient).mockResolvedValue(
      createSupabaseClientMock({
        user: null,
      }) as never,
    );

    const response = await POST(createJsonRequest(VALID_INPUT));

    expect(response.status).toBe(401);

    await expect(response.json()).resolves.toEqual({
      error: "로그인이 필요합니다.",
    });

    expect(
      runtimeMocks.resolveAiRuntimeChatConfiguration,
    ).not.toHaveBeenCalled();
  });

  it("사용자 인증 조회가 실패하면 401을 반환한다", async () => {
    vi.mocked(createClient).mockResolvedValue(
      createSupabaseClientMock({
        user: null,
        userError: {
          message: "Auth failed",
        },
      }) as never,
    );

    const response = await POST(createJsonRequest(VALID_INPUT));

    expect(response.status).toBe(401);

    await expect(response.json()).resolves.toEqual({
      error: "로그인이 필요합니다.",
    });
  });

  it("이메일 확인이 완료되지 않은 사용자는 403을 반환한다", async () => {
    vi.mocked(createClient).mockResolvedValue(
      createSupabaseClientMock({
        user: {
          id: "99999999-9999-4999-8999-999999999999",
          email_confirmed_at: null,
        },
      }) as never,
    );

    const response = await POST(createJsonRequest(VALID_INPUT));

    expect(response.status).toBe(403);

    await expect(response.json()).resolves.toEqual({
      error: "이메일 확인이 필요합니다.",
    });

    expect(
      runtimeMocks.resolveAiRuntimeChatConfiguration,
    ).not.toHaveBeenCalled();
  });

  it("AI Runtime 설정 조회가 실패하면 500을 반환한다", async () => {
    const supabase = createSupabaseClientMock({
      user: {
        id: "99999999-9999-4999-8999-999999999999",
        email_confirmed_at: "2026-08-06T00:00:00.000Z",
      },
    });

    vi.mocked(createClient).mockResolvedValue(supabase as never);

    runtimeMocks.resolveAiRuntimeChatConfiguration.mockRejectedValue(
      new Error("Runtime resolution failed"),
    );

    const response = await POST(createJsonRequest(VALID_INPUT));

    expect(response.status).toBe(500);

    await expect(response.json()).resolves.toEqual({
      error: "노트 챗봇 AI 설정을 불러오지 못했습니다.",
    });

    expect(supabase.rpc).not.toHaveBeenCalled();
    expect(runNoteChatStream).not.toHaveBeenCalled();
  });

  it("질문 생성 RPC가 실패하면 500을 반환한다", async () => {
    const supabase = createSupabaseClientMock({
      user: {
        id: "99999999-9999-4999-8999-999999999999",
        email_confirmed_at: "2026-08-06T00:00:00.000Z",
      },
      rpcError: {
        message: "Question creation failed",
      },
    });

    vi.mocked(createClient).mockResolvedValue(supabase as never);

    const response = await POST(createJsonRequest(VALID_INPUT));

    expect(response.status).toBe(500);

    await expect(response.json()).resolves.toEqual({
      error: "질문 생성에 실패했습니다. 잠시 후 다시 시도해 주세요.",
    });

    expect(runNoteChatStream).not.toHaveBeenCalled();
  });

  it("질문 생성 RPC가 결과를 반환하지 않으면 500을 반환한다", async () => {
    const supabase = createSupabaseClientMock({
      user: {
        id: "99999999-9999-4999-8999-999999999999",
        email_confirmed_at: "2026-08-06T00:00:00.000Z",
      },
      rpcData: null,
    });

    vi.mocked(createClient).mockResolvedValue(supabase as never);

    const response = await POST(createJsonRequest(VALID_INPUT));

    expect(response.status).toBe(500);
    expect(runNoteChatStream).not.toHaveBeenCalled();
  });

  it("Runtime 설정으로 질문과 Pending Run을 생성하고 NDJSON 스트림을 반환한다", async () => {
    const supabase = createSupabaseClientMock({
      user: {
        id: "99999999-9999-4999-8999-999999999999",
        email_confirmed_at: "2026-08-06T00:00:00.000Z",
      },
      rpcData: {
        run_id: RUN_ID,
        user_message_id: USER_MESSAGE_ID,
      },
    });

    vi.mocked(createClient).mockResolvedValue(supabase as never);

    vi.mocked(runNoteChatStream).mockImplementation(
      async (_params, onEvent) => {
        await onEvent({
          runId: RUN_ID,
          type: "start",
        });

        await onEvent({
          delta: "첫 번째 ",
          type: "text-delta",
        });

        await onEvent({
          delta: "답변",
          type: "text-delta",
        });

        await onEvent({
          assistantMessageId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          referencedNoteIds: [],
          runId: RUN_ID,
          type: "finish",
        });

        return {
          assistantMessageId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          content: "첫 번째 답변",
          referencedNoteIds: [],
          runId: RUN_ID,
          usage: {
            inputTokens: 5,
            outputTokens: 3,
            totalTokens: 8,
          },
        };
      },
    );

    const response = await POST(createJsonRequest(VALID_INPUT));

    expect(response.status).toBe(200);

    expect(response.headers.get("Content-Type")).toBe(
      "application/x-ndjson; charset=utf-8",
    );
    expect(response.headers.get("Cache-Control")).toBe(
      "no-cache, no-transform",
    );
    expect(response.headers.get("X-Accel-Buffering")).toBe("no");

    expect(
      runtimeMocks.resolveAiRuntimeChatConfiguration,
    ).toHaveBeenCalledTimes(1);

    expect(
      runtimeMocks.resolveAiRuntimeEmbeddingConfiguration,
    ).toHaveBeenCalledTimes(1);

    expect(supabase.rpc).toHaveBeenCalledWith("create_note_chat_question", {
      p_agent_id: AGENT_ID,
      p_chat_model_config_id: CHAT_MODEL_CONFIG_ID,
      p_content: VALID_INPUT.content,
      p_conversation_id: CONVERSATION_ID,
      p_embedding_model_config_id: EMBEDDING_MODEL_CONFIG_ID,
      p_prompt_version_id: PROMPT_VERSION_ID,
    });

    const events = await readNdjsonEvents(response);

    expect(runNoteChatStream).toHaveBeenCalledWith(
      {
        conversationId: CONVERSATION_ID,
        runId: RUN_ID,
        settings: EXECUTION_SETTINGS,
        userMessageId: USER_MESSAGE_ID,
      },
      expect.any(Function),
    );

    expect(events).toEqual([
      {
        runId: RUN_ID,
        type: "start",
      },
      {
        delta: "첫 번째 ",
        type: "text-delta",
      },
      {
        delta: "답변",
        type: "text-delta",
      },
      {
        assistantMessageId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        referencedNoteIds: [],
        runId: RUN_ID,
        type: "finish",
      },
    ]);
  });

  it("실행이 오류 이벤트 없이 실패하면 Route가 오류 이벤트를 전달한다", async () => {
    vi.mocked(createClient).mockResolvedValue(
      createSupabaseClientMock({
        user: {
          id: "99999999-9999-4999-8999-999999999999",
          email_confirmed_at: "2026-08-06T00:00:00.000Z",
        },
        rpcData: {
          run_id: RUN_ID,
          user_message_id: USER_MESSAGE_ID,
        },
      }) as never,
    );

    vi.mocked(runNoteChatStream).mockRejectedValue(
      new Error("Run start failed"),
    );

    const response = await POST(createJsonRequest(VALID_INPUT));
    const events = await readNdjsonEvents(response);

    expect(events).toEqual([
      {
        message: "답변 생성에 실패했습니다.",
        runId: RUN_ID,
        type: "error",
      },
    ]);
  });

  it("실행 함수가 이미 오류 이벤트를 보냈으면 중복 전송하지 않는다", async () => {
    vi.mocked(createClient).mockResolvedValue(
      createSupabaseClientMock({
        user: {
          id: "99999999-9999-4999-8999-999999999999",
          email_confirmed_at: "2026-08-06T00:00:00.000Z",
        },
        rpcData: {
          run_id: RUN_ID,
          user_message_id: USER_MESSAGE_ID,
        },
      }) as never,
    );

    vi.mocked(runNoteChatStream).mockImplementation(
      async (_params, onEvent) => {
        await onEvent({
          message: "답변 생성에 실패했습니다.",
          runId: RUN_ID,
          type: "error",
        });

        throw new Error("Provider failed");
      },
    );

    const response = await POST(createJsonRequest(VALID_INPUT));
    const events = await readNdjsonEvents(response);

    expect(events).toEqual([
      {
        message: "답변 생성에 실패했습니다.",
        runId: RUN_ID,
        type: "error",
      },
    ]);
  });
});
