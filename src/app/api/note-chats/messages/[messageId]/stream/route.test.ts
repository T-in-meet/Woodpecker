import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  resolveAiRuntimeChatConfiguration,
  resolveAiRuntimeEmbeddingConfiguration,
} from "@/features/ai/runtimes/resolve-configuration";
import { markAiOperationalErrorAsReported } from "@/features/ai/utils/report-ai-operational-error";
import {
  NOTE_CHAT_AI_FEATURE_KEY,
  NOTE_CHAT_AI_ROLE_KEY,
} from "@/features/note-chats/constants/ai";
import { NOTE_CHAT_DAILY_EXECUTION_LIMIT_ERROR_CODE } from "@/features/note-chats/constants/execution";
import { assertNoteChatDailyExecutionLimit } from "@/features/note-chats/execution/assert-daily-execution-limit";
import { runNoteChatStream } from "@/features/note-chats/stream/run-note-chat-stream";
import { reportNoteChatOperationalError } from "@/features/note-chats/utils/report-operational-error";
import { createClient } from "@/lib/supabase/server";

import { POST } from "./route";

vi.mock("@/features/ai/runtimes/resolve-configuration", () => ({
  resolveAiRuntimeChatConfiguration: vi.fn(),
  resolveAiRuntimeEmbeddingConfiguration: vi.fn(),
}));

vi.mock("@/features/note-chats/execution/assert-daily-execution-limit", () => ({
  assertNoteChatDailyExecutionLimit: vi.fn(),
}));

vi.mock("@/features/note-chats/stream/run-note-chat-stream", () => ({
  runNoteChatStream: vi.fn(),
}));

vi.mock("@/features/note-chats/utils/report-operational-error", () => ({
  reportNoteChatOperationalError: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

const MESSAGE_ID = "550e8400-e29b-41d4-a716-446655440001";
const CONVERSATION_ID = "550e8400-e29b-41d4-a716-446655440002";
const RUN_ID = "550e8400-e29b-41d4-a716-446655440003";
const USER_MESSAGE_ID = MESSAGE_ID;
const ASSISTANT_MESSAGE_ID = "550e8400-e29b-41d4-a716-446655440004";

const USER = {
  id: "550e8400-e29b-41d4-a716-446655440010",
  email_confirmed_at: "2026-08-11T00:00:00.000Z",
};

const CHAT_CONFIGURATION = {
  kind: "chat",
  featureKey: NOTE_CHAT_AI_FEATURE_KEY,
  roleKey: NOTE_CHAT_AI_ROLE_KEY.ANSWER_GENERATION,
  model: {
    id: "550e8400-e29b-41d4-a716-446655440011",
    model: "gpt-4.1-mini",
    provider: "openai",
    capability: "chat",
    created_at: "2026-08-11T00:00:00.000Z",
    dimensions: null,
    display_name: "Test Chat Model",
    distance_metric: null,
    is_active: true,
    updated_at: "2026-08-11T00:00:00.000Z",
  },
  prompt: {
    agent: {
      id: "550e8400-e29b-41d4-a716-446655440012",
      active_prompt_version_id: "550e8400-e29b-41d4-a716-446655440013",
      created_at: "2026-08-11T00:00:00.000Z",
      description: null,
      display_name: "Test Agent",
      key: "test-agent",
      purpose: "test",
      tags: [],
      updated_at: "2026-08-11T00:00:00.000Z",
    },
    family: {
      id: "550e8400-e29b-41d4-a716-446655440014",
      agent_id: "550e8400-e29b-41d4-a716-446655440012",
      created_at: "2026-08-11T00:00:00.000Z",
      display_name: "Test Family",
      key: "test-family",
      updated_at: "2026-08-11T00:00:00.000Z",
    },
    version: {
      id: "550e8400-e29b-41d4-a716-446655440013",
      family_id: "550e8400-e29b-41d4-a716-446655440014",
      version_number: 1,
      display_name: "Test Prompt",
      lifecycle: "published",
      system_template: "System",
      user_template: "User",
      response_schema: null,
      change_summary: null,
      created_at: "2026-08-11T00:00:00.000Z",
      created_by_kind: "system",
      updated_at: "2026-08-11T00:00:00.000Z",
    },
  },
  temperature: 0.2,
};

const QUERY_EXPANSION_CONFIGURATION = {
  kind: "chat",
  featureKey: NOTE_CHAT_AI_FEATURE_KEY,
  roleKey: NOTE_CHAT_AI_ROLE_KEY.QUERY_EXPANSION,
  model: {
    id: "550e8400-e29b-41d4-a716-446655440015",
    model: "gpt-4.1-mini",
    provider: "openai",
    capability: "chat",
    created_at: "2026-08-11T00:00:00.000Z",
    dimensions: null,
    display_name: "Query Expansion Model",
    distance_metric: null,
    is_active: true,
    updated_at: "2026-08-11T00:00:00.000Z",
  },
  prompt: {
    agent: {
      id: "550e8400-e29b-41d4-a716-446655440016",
      active_prompt_version_id: "550e8400-e29b-41d4-a716-446655440017",
      created_at: "2026-08-11T00:00:00.000Z",
      description: null,
      display_name: "Query Expansion Agent",
      key: "query-expansion",
      purpose: "test",
      tags: [],
      updated_at: "2026-08-11T00:00:00.000Z",
    },
    family: {
      id: "550e8400-e29b-41d4-a716-446655440018",
      agent_id: "550e8400-e29b-41d4-a716-446655440016",
      created_at: "2026-08-11T00:00:00.000Z",
      display_name: "Query Expansion Family",
      key: "query-expansion",
      updated_at: "2026-08-11T00:00:00.000Z",
    },
    version: {
      id: "550e8400-e29b-41d4-a716-446655440017",
      family_id: "550e8400-e29b-41d4-a716-446655440018",
      version_number: 1,
      display_name: "Query Expansion Prompt",
      lifecycle: "published",
      system_template: "System",
      user_template: "User",
      response_schema: null,
      change_summary: null,
      created_at: "2026-08-11T00:00:00.000Z",
      created_by_kind: "system",
      updated_at: "2026-08-11T00:00:00.000Z",
    },
  },
  temperature: 0,
};

const EMBEDDING_CONFIGURATION = {
  kind: "embedding",
  featureKey: NOTE_CHAT_AI_FEATURE_KEY,
  roleKey: NOTE_CHAT_AI_ROLE_KEY.NOTE_RETRIEVAL,
  model: {
    id: "550e8400-e29b-41d4-a716-446655440019",
    model: "text-embedding-3-small",
    provider: "openai",
    capability: "embedding",
    created_at: "2026-08-11T00:00:00.000Z",
    dimensions: 1536,
    display_name: "Test Embedding Model",
    distance_metric: "cosine",
    is_active: true,
    updated_at: "2026-08-11T00:00:00.000Z",
  },
};

const UPDATED_RESULT = {
  run_id: RUN_ID,
  user_message_id: USER_MESSAGE_ID,
};

const RUN_RESULT = {
  assistantMessageId: ASSISTANT_MESSAGE_ID,
  content: "수정된 답변입니다.",
  runId: RUN_ID,
  usage: {
    inputTokens: 10,
    outputTokens: 20,
    totalTokens: 30,
  },
  usedNoteIds: [],
};

type SupabaseClientMockOptions = {
  targetMessage?: {
    conversation_id: string;
    role: "user" | "assistant";
  } | null;
  targetMessageError?: Error | null;
  updateResult?: typeof UPDATED_RESULT | null;
  updateError?: Error | null;
};

function createSupabaseClientMock(options: SupabaseClientMockOptions = {}) {
  const targetMessage =
    options.targetMessage === undefined
      ? {
          conversation_id: CONVERSATION_ID,
          role: "user" as const,
        }
      : options.targetMessage;

  const targetMessageError = options.targetMessageError ?? null;
  const updateResult =
    options.updateResult === undefined ? UPDATED_RESULT : options.updateResult;
  const updateError = options.updateError ?? null;

  const select = vi.fn().mockReturnValue({
    eq: vi.fn().mockReturnValue({
      single: vi.fn().mockResolvedValue({
        data: targetMessage,
        error: targetMessageError,
      }),
    }),
  });

  const from = vi.fn().mockReturnValue({
    select,
  });

  const rpc = vi.fn().mockReturnValue({
    single: vi.fn().mockResolvedValue({
      data: updateResult,
      error: updateError,
    }),
  });

  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: {
          user: USER,
        },
        error: null,
      }),
    },
    from,
    rpc,
  };
}

function createRequest(body: unknown): Request {
  return new Request(
    "http://localhost/api/note-chats/messages/" + MESSAGE_ID + "/stream",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    },
  );
}

async function readStream(response: Response): Promise<string[]> {
  const text = await response.text();

  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

beforeEach(() => {
  vi.clearAllMocks();

  vi.mocked(reportNoteChatOperationalError).mockResolvedValue(undefined);

  vi.mocked(assertNoteChatDailyExecutionLimit).mockResolvedValue(undefined);

  vi.mocked(resolveAiRuntimeChatConfiguration)
    .mockResolvedValueOnce(CHAT_CONFIGURATION as never)
    .mockResolvedValueOnce(QUERY_EXPANSION_CONFIGURATION as never);

  vi.mocked(resolveAiRuntimeEmbeddingConfiguration).mockResolvedValue(
    EMBEDDING_CONFIGURATION as never,
  );

  vi.mocked(runNoteChatStream).mockResolvedValue(RUN_RESULT);

  const client = createSupabaseClientMock();

  vi.mocked(createClient).mockResolvedValue(client as never);
});

describe("POST /api/note-chats/messages/[messageId]/stream", () => {
  it("요청 본문이 잘못된 JSON이면 400을 반환한다", async () => {
    const request = new Request(
      `http://localhost/api/note-chats/messages/${MESSAGE_ID}/stream`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: "{invalid",
      },
    );

    const response = await POST(request, {
      params: Promise.resolve({
        messageId: MESSAGE_ID,
      }),
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "요청 본문이 올바른 JSON 형식이 아닙니다.",
    });
  });

  it("질문 수정 정보가 올바르지 않으면 400을 반환한다", async () => {
    const response = await POST(
      createRequest({
        content: {
          text: "",
        },
      }),
      {
        params: Promise.resolve({
          messageId: MESSAGE_ID,
        }),
      },
    );

    expect(response.status).toBe(400);
  });

  it("로그인하지 않은 경우 401을 반환한다", async () => {
    const client = createSupabaseClientMock();

    client.auth.getUser.mockResolvedValue({
      data: {
        user: null,
      },
      error: null,
    });

    vi.mocked(createClient).mockResolvedValue(client as never);

    const response = await POST(
      createRequest({
        content: {
          text: "수정된 질문",
        },
      }),
      {
        params: Promise.resolve({
          messageId: MESSAGE_ID,
        }),
      },
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: "로그인이 필요합니다.",
    });
  });

  it("이메일이 확인되지 않은 경우 403을 반환한다", async () => {
    const client = createSupabaseClientMock();

    client.auth.getUser.mockResolvedValue({
      data: {
        user: {
          ...USER,
          email_confirmed_at: null,
        },
      },
      error: null,
    });

    vi.mocked(createClient).mockResolvedValue(client as never);

    const response = await POST(
      createRequest({
        content: {
          text: "수정된 질문",
        },
      }),
      {
        params: Promise.resolve({
          messageId: MESSAGE_ID,
        }),
      },
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: "이메일 확인이 필요합니다.",
    });
  });

  it("일일 실행 제한을 초과하면 429를 반환한다", async () => {
    vi.mocked(assertNoteChatDailyExecutionLimit).mockRejectedValue(
      new Error(NOTE_CHAT_DAILY_EXECUTION_LIMIT_ERROR_CODE),
    );

    const response = await POST(
      createRequest({
        content: {
          text: "수정된 질문",
        },
      }),
      {
        params: Promise.resolve({
          messageId: MESSAGE_ID,
        }),
      },
    );

    expect(response.status).toBe(429);
    await expect(response.json()).resolves.toEqual({
      code: NOTE_CHAT_DAILY_EXECUTION_LIMIT_ERROR_CODE,
      error: "오늘 사용할 수 있는 노트 챗봇 횟수를 모두 사용했습니다.",
    });

    expect(reportNoteChatOperationalError).not.toHaveBeenCalled();
  });

  it("일일 실행 제한 확인에 실패하면 운영 오류를 기록하고 500을 반환한다", async () => {
    const error = new Error("daily limit check failed");

    vi.mocked(assertNoteChatDailyExecutionLimit).mockRejectedValue(error);

    const response = await POST(
      createRequest({
        content: {
          text: "수정된 질문",
        },
      }),
      {
        params: Promise.resolve({
          messageId: MESSAGE_ID,
        }),
      },
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "노트 챗봇 사용량을 확인하지 못했습니다.",
    });

    expect(reportNoteChatOperationalError).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: USER.id,
        error,
        errorCode: "NOTE_CHAT_DAILY_EXECUTION_LIMIT_CHECK_FAILED",
        userId: USER.id,
      }),
    );
  });

  it("수정 대상 메시지 조회에 실패하면 운영 오류를 기록하고 500을 반환한다", async () => {
    const error = new Error("message load failed");

    const client = createSupabaseClientMock({
      targetMessage: null,
      targetMessageError: error,
    });

    vi.mocked(createClient).mockResolvedValue(client as never);

    const response = await POST(
      createRequest({
        content: {
          text: "수정된 질문",
        },
      }),
      {
        params: Promise.resolve({
          messageId: MESSAGE_ID,
        }),
      },
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "수정할 사용자 메시지를 확인하지 못했습니다.",
    });

    expect(reportNoteChatOperationalError).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: USER.id,
        context: {
          messageId: MESSAGE_ID,
        },
        error,
        errorCode: "NOTE_CHAT_USER_MESSAGE_LOAD_FAILED",
        userId: USER.id,
      }),
    );
  });

  it("수정 대상 메시지가 없으면 404를 반환한다", async () => {
    const client = createSupabaseClientMock({
      targetMessage: null,
    });

    vi.mocked(createClient).mockResolvedValue(client as never);

    const response = await POST(
      createRequest({
        content: {
          text: "수정된 질문",
        },
      }),
      {
        params: Promise.resolve({
          messageId: MESSAGE_ID,
        }),
      },
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: "수정할 사용자 메시지를 찾을 수 없습니다.",
    });

    expect(reportNoteChatOperationalError).not.toHaveBeenCalled();
  });

  it("수정 대상 메시지가 User Message가 아니면 404를 반환한다", async () => {
    const client = createSupabaseClientMock({
      targetMessage: {
        conversation_id: CONVERSATION_ID,
        role: "assistant",
      },
    });

    vi.mocked(createClient).mockResolvedValue(client as never);

    const response = await POST(
      createRequest({
        content: {
          text: "수정된 질문",
        },
      }),
      {
        params: Promise.resolve({
          messageId: MESSAGE_ID,
        }),
      },
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: "수정할 사용자 메시지를 찾을 수 없습니다.",
    });

    expect(reportNoteChatOperationalError).not.toHaveBeenCalled();
  });

  it("Runtime Configuration 조회에 실패하면 운영 오류를 기록하고 500을 반환한다", async () => {
    const error = new Error("runtime configuration load failed");

    vi.mocked(resolveAiRuntimeChatConfiguration).mockReset();
    vi.mocked(resolveAiRuntimeChatConfiguration).mockRejectedValue(error);

    const response = await POST(
      createRequest({
        content: {
          text: "수정된 질문",
        },
      }),
      {
        params: Promise.resolve({
          messageId: MESSAGE_ID,
        }),
      },
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "노트 챗봇 AI 설정을 불러오지 못했습니다.",
    });

    expect(reportNoteChatOperationalError).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: USER.id,
        error,
        errorCode: "NOTE_CHAT_AI_CONFIGURATION_LOAD_FAILED",
        userId: USER.id,
      }),
    );
  });

  it("이미 AI Foundation에서 보고된 Runtime Configuration 실패는 중복 기록하지 않는다", async () => {
    const error = markAiOperationalErrorAsReported(
      new Error("reported runtime configuration load failed"),
    );

    vi.mocked(resolveAiRuntimeChatConfiguration).mockReset();
    vi.mocked(resolveAiRuntimeChatConfiguration).mockRejectedValue(error);

    const response = await POST(
      createRequest({
        content: {
          text: "수정된 질문",
        },
      }),
      {
        params: Promise.resolve({
          messageId: MESSAGE_ID,
        }),
      },
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "노트 챗봇 AI 설정을 불러오지 못했습니다.",
    });

    expect(reportNoteChatOperationalError).not.toHaveBeenCalled();
    expect(runNoteChatStream).not.toHaveBeenCalled();
  });

  it("사용자 메시지 수정 RPC가 실패하면 운영 오류를 기록하고 500을 반환한다", async () => {
    const error = new Error("update failed");

    const client = createSupabaseClientMock({
      updateError: error,
    });

    vi.mocked(createClient).mockResolvedValue(client as never);

    const response = await POST(
      createRequest({
        content: {
          text: "수정된 질문",
        },
      }),
      {
        params: Promise.resolve({
          messageId: MESSAGE_ID,
        }),
      },
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "질문 수정에 실패했습니다. 잠시 후 다시 시도해 주세요.",
    });

    expect(reportNoteChatOperationalError).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: USER.id,
        context: {
          conversationId: CONVERSATION_ID,
          messageId: MESSAGE_ID,
        },
        error,
        errorCode: "NOTE_CHAT_USER_MESSAGE_UPDATE_FAILED",
        userId: USER.id,
      }),
    );
  });

  it("사용자 메시지 수정 RPC 결과가 없으면 운영 오류를 기록하고 500을 반환한다", async () => {
    const client = createSupabaseClientMock({
      updateResult: null,
    });

    vi.mocked(createClient).mockResolvedValue(client as never);

    const response = await POST(
      createRequest({
        content: {
          text: "수정된 질문",
        },
      }),
      {
        params: Promise.resolve({
          messageId: MESSAGE_ID,
        }),
      },
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "질문 수정에 실패했습니다. 잠시 후 다시 시도해 주세요.",
    });

    expect(reportNoteChatOperationalError).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: USER.id,
        context: {
          conversationId: CONVERSATION_ID,
          messageId: MESSAGE_ID,
        },
        errorCode: "NOTE_CHAT_USER_MESSAGE_UPDATE_FAILED",
        userId: USER.id,
      }),
    );
  });

  it("정상 요청이면 메시지를 수정하고 AI 스트림을 시작한다", async () => {
    const client = createSupabaseClientMock();

    vi.mocked(createClient).mockResolvedValue(client as never);

    const response = await POST(
      createRequest({
        content: {
          text: "수정된 질문",
        },
      }),
      {
        params: Promise.resolve({
          messageId: MESSAGE_ID,
        }),
      },
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe(
      "application/x-ndjson; charset=utf-8",
    );

    expect(client.rpc).toHaveBeenCalledWith("update_note_chat_user_message", {
      p_agent_id: CHAT_CONFIGURATION.prompt.agent.id,
      p_chat_model_config_id: CHAT_CONFIGURATION.model.id,
      p_content: {
        text: "수정된 질문",
      },
      p_embedding_model_config_id: EMBEDDING_CONFIGURATION.model.id,
      p_message_id: MESSAGE_ID,
      p_prompt_version_id: CHAT_CONFIGURATION.prompt.version.id,
    });

    expect(runNoteChatStream).toHaveBeenCalledWith(
      expect.objectContaining({
        conversationId: CONVERSATION_ID,
        runId: RUN_ID,
        userId: USER.id,
        userMessageId: USER_MESSAGE_ID,
      }),
      expect.any(Function),
    );
  });

  it("Run 실행 중 발생한 스트림 이벤트를 NDJSON으로 전달한다", async () => {
    vi.mocked(runNoteChatStream).mockImplementation(async (params, onEvent) => {
      await onEvent({
        type: "start",
        runId: params.runId,
        userMessageId: params.userMessageId,
      });

      await onEvent({
        type: "text-delta",
        delta: "수정된 답변입니다.",
      });

      await onEvent({
        type: "finish",
        runId: params.runId,
        assistantMessageId: ASSISTANT_MESSAGE_ID,
        usedNoteIds: [],
      });

      return RUN_RESULT;
    });

    const response = await POST(
      createRequest({
        content: {
          text: "수정된 질문",
        },
      }),
      {
        params: Promise.resolve({
          messageId: MESSAGE_ID,
        }),
      },
    );

    const lines = await readStream(response);

    expect(lines).toEqual([
      JSON.stringify({
        type: "start",
        runId: RUN_ID,
        userMessageId: USER_MESSAGE_ID,
      }),
      JSON.stringify({
        type: "text-delta",
        delta: "수정된 답변입니다.",
      }),
      JSON.stringify({
        type: "finish",
        runId: RUN_ID,
        assistantMessageId: ASSISTANT_MESSAGE_ID,
        usedNoteIds: [],
      }),
    ]);
  });

  it("Run 실행 중 error 이벤트가 발생하면 해당 이벤트를 전달한다", async () => {
    vi.mocked(runNoteChatStream).mockImplementation(async (params, onEvent) => {
      await onEvent({
        type: "error",
        message: "답변 생성에 실패했습니다.",
        runId: params.runId,
      });

      return RUN_RESULT;
    });

    const response = await POST(
      createRequest({
        content: {
          text: "수정된 질문",
        },
      }),
      {
        params: Promise.resolve({
          messageId: MESSAGE_ID,
        }),
      },
    );

    const lines = await readStream(response);

    expect(lines).toEqual([
      JSON.stringify({
        type: "error",
        message: "답변 생성에 실패했습니다.",
        runId: RUN_ID,
      }),
    ]);
  });

  it("Run 실행이 예외를 발생시키고 error 이벤트가 없으면 기본 error 이벤트를 전달한다", async () => {
    vi.mocked(runNoteChatStream).mockRejectedValue(new Error("stream failed"));

    const response = await POST(
      createRequest({
        content: {
          text: "수정된 질문",
        },
      }),
      {
        params: Promise.resolve({
          messageId: MESSAGE_ID,
        }),
      },
    );

    const lines = await readStream(response);

    expect(lines).toEqual([
      JSON.stringify({
        message: "답변 생성에 실패했습니다.",
        runId: RUN_ID,
        type: "error",
      }),
    ]);
  });

  it("Run 실행에서 error 이벤트가 전달된 경우 예외가 발생해도 중복 error 이벤트를 전달하지 않는다", async () => {
    vi.mocked(runNoteChatStream).mockImplementation(async (params, onEvent) => {
      await onEvent({
        type: "error",
        message: "실행 실패",
        runId: params.runId,
      });

      throw new Error("stream failed after error event");
    });

    const response = await POST(
      createRequest({
        content: {
          text: "수정된 질문",
        },
      }),
      {
        params: Promise.resolve({
          messageId: MESSAGE_ID,
        }),
      },
    );

    const lines = await readStream(response);

    expect(lines).toEqual([
      JSON.stringify({
        type: "error",
        message: "실행 실패",
        runId: RUN_ID,
      }),
    ]);
  });
});
