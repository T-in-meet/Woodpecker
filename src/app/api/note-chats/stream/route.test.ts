import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  resolveAiRuntimeChatConfiguration,
  resolveAiRuntimeEmbeddingConfiguration,
} from "@/features/ai/runtimes/resolve-configuration";
import { assertNoteChatDailyExecutionLimit } from "@/features/note-chats/execution/assert-daily-execution-limit";
import type { RunNoteChatStreamResult } from "@/features/note-chats/stream/run-note-chat-stream";
import { runNoteChatStream } from "@/features/note-chats/stream/run-note-chat-stream";
import { reportNoteChatOperationalError } from "@/features/note-chats/utils/report-operational-error";
import { createClient } from "@/lib/supabase/server";

import { POST } from "./route";

vi.mock("server-only", () => ({}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/features/ai/runtimes/resolve-configuration", () => ({
  resolveAiRuntimeChatConfiguration: vi.fn(),
  resolveAiRuntimeEmbeddingConfiguration: vi.fn(),
}));

vi.mock("@/features/note-chats/stream/run-note-chat-stream", () => ({
  runNoteChatStream: vi.fn(),
}));

vi.mock("@/features/note-chats/utils/report-operational-error", () => ({
  reportNoteChatOperationalError: vi.fn(),
}));

vi.mock("@/features/note-chats/execution/assert-daily-execution-limit", () => ({
  assertNoteChatDailyExecutionLimit: vi.fn(),
}));

const USER_ID = "550e8400-e29b-41d4-a716-446655440000";
const CONVERSATION_ID = "550e8400-e29b-41d4-a716-446655440001";
const RUN_ID = "550e8400-e29b-41d4-a716-446655440002";
const USER_MESSAGE_ID = "550e8400-e29b-41d4-a716-446655440003";
const ASSISTANT_MESSAGE_ID = "550e8400-e29b-41d4-a716-446655440004";

const CHAT_CONFIGURATION = {
  kind: "chat",
  featureKey: "note-chat",
  roleKey: "answer-generation",
  model: {
    id: "550e8400-e29b-41d4-a716-446655440010",
    model: "gpt-test",
    provider: "openai",
  },
  prompt: {
    agent: {
      id: "550e8400-e29b-41d4-a716-446655440011",
    },
    family: {
      id: "550e8400-e29b-41d4-a716-446655440012",
    },
    version: {
      id: "550e8400-e29b-41d4-a716-446655440013",
      system_template: "system",
      user_template: "user",
      response_schema: null,
    },
  },
  temperature: 0.2,
};

const QUERY_EXPANSION_CONFIGURATION = {
  ...CHAT_CONFIGURATION,
  roleKey: "query-expansion",
};

const EMBEDDING_CONFIGURATION = {
  kind: "embedding",
  featureKey: "note-chat",
  roleKey: "note-retrieval",
  model: {
    id: "550e8400-e29b-41d4-a716-446655440020",
    model: "text-embedding-test",
    provider: "openai",
  },
};

const CREATED_QUESTION = {
  run_id: RUN_ID,
  user_message_id: USER_MESSAGE_ID,
};

const RUN_RESULT = {} as RunNoteChatStreamResult;

const createSupabaseClientMock = ({
  user = {
    id: USER_ID,
    email_confirmed_at: "2026-08-11T00:00:00.000Z",
  },
  userError = null,
  rpcData = CREATED_QUESTION,
  rpcError = null,
}: {
  user?: {
    id: string;
    email_confirmed_at: string | null;
  } | null;
  userError?: Error | null;
  rpcData?: typeof CREATED_QUESTION | null;
  rpcError?: Error | null;
} = {}) => {
  const auth = {
    getUser: vi.fn().mockResolvedValue({
      data: {
        user,
      },
      error: userError,
    }),
  };

  const single = vi.fn().mockResolvedValue({
    data: rpcData,
    error: rpcError,
  });

  const rpc = vi.fn().mockReturnValue({
    single,
  });

  return {
    auth,
    rpc,
  };
};

const createRequest = (body: unknown) =>
  new Request("http://localhost/api/note-chats/stream", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

const readStream = async (response: Response): Promise<string[]> => {
  expect(response.body).not.toBeNull();

  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  const chunks: string[] = [];

  while (true) {
    const { done, value } = await reader.read();

    if (done) {
      break;
    }

    chunks.push(decoder.decode(value));
  }

  return chunks.join("").trim().split("\n").filter(Boolean);
};

describe("POST /api/note-chats/stream", () => {
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

  it("잘못된 JSON 요청이면 400을 반환한다", async () => {
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
  });

  it("잘못된 질문 입력이면 400을 반환한다", async () => {
    const response = await POST(
      createRequest({
        conversationId: "invalid-conversation-id",
        content: {
          text: "",
        },
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: expect.any(String),
    });

    expect(createClient).not.toHaveBeenCalled();
  });

  it("로그인하지 않은 경우 401을 반환한다", async () => {
    const client = createSupabaseClientMock({
      user: null,
      userError: null,
    });

    vi.mocked(createClient).mockResolvedValue(client as never);

    const response = await POST(
      createRequest({
        conversationId: CONVERSATION_ID,
        content: {
          text: "질문입니다.",
        },
      }),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: "로그인이 필요합니다.",
    });

    expect(client.auth.getUser).toHaveBeenCalledTimes(1);
    expect(client.rpc).not.toHaveBeenCalled();
    expect(runNoteChatStream).not.toHaveBeenCalled();
  });

  it("이메일이 확인되지 않은 경우 403을 반환한다", async () => {
    const client = createSupabaseClientMock({
      user: {
        id: USER_ID,
        email_confirmed_at: null,
      },
    });

    vi.mocked(createClient).mockResolvedValue(client as never);

    const response = await POST(
      createRequest({
        conversationId: CONVERSATION_ID,
        content: {
          text: "질문입니다.",
        },
      }),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: "이메일 확인이 필요합니다.",
    });

    expect(client.rpc).not.toHaveBeenCalled();
    expect(runNoteChatStream).not.toHaveBeenCalled();
  });

  it("Runtime Configuration 조회에 실패하면 운영 오류를 기록하고 500을 반환한다", async () => {
    const client = createSupabaseClientMock();

    vi.mocked(createClient).mockResolvedValue(client as never);

    const configurationError = new Error("configuration load failed");

    vi.mocked(resolveAiRuntimeChatConfiguration).mockReset();
    vi.mocked(resolveAiRuntimeChatConfiguration).mockRejectedValue(
      configurationError,
    );

    const response = await POST(
      createRequest({
        conversationId: CONVERSATION_ID,
        content: {
          text: "질문입니다.",
        },
      }),
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "노트 챗봇 AI 설정을 불러오지 못했습니다.",
    });

    expect(reportNoteChatOperationalError).toHaveBeenCalledTimes(1);
    expect(reportNoteChatOperationalError).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: USER_ID,
        error: configurationError,
        errorCode: expect.any(String),
        message: "노트 챗봇 AI 실행 설정 조회에 실패했습니다.",
        userId: USER_ID,
      }),
    );

    expect(client.rpc).not.toHaveBeenCalled();
    expect(runNoteChatStream).not.toHaveBeenCalled();
  });

  it("질문 생성 RPC가 실패하면 운영 오류를 기록하고 500을 반환한다", async () => {
    const createError = new Error("question create failed");

    const client = createSupabaseClientMock({
      rpcData: null,
      rpcError: createError,
    });

    vi.mocked(createClient).mockResolvedValue(client as never);

    const response = await POST(
      createRequest({
        conversationId: CONVERSATION_ID,
        content: {
          text: "질문입니다.",
        },
      }),
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "질문 생성에 실패했습니다. 잠시 후 다시 시도해 주세요.",
    });

    expect(client.rpc).toHaveBeenCalledWith(
      "create_note_chat_question",
      expect.objectContaining({
        p_agent_id: CHAT_CONFIGURATION.prompt.agent.id,
        p_chat_model_config_id: CHAT_CONFIGURATION.model.id,
        p_content: {
          text: "질문입니다.",
        },
        p_conversation_id: CONVERSATION_ID,
        p_embedding_model_config_id: EMBEDDING_CONFIGURATION.model.id,
        p_prompt_version_id: CHAT_CONFIGURATION.prompt.version.id,
      }),
    );

    expect(reportNoteChatOperationalError).toHaveBeenCalledTimes(1);
    expect(reportNoteChatOperationalError).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: USER_ID,
        context: {
          conversationId: CONVERSATION_ID,
        },
        error: createError,
        message: "노트 챗봇 질문 생성에 실패했습니다.",
        userId: USER_ID,
      }),
    );

    expect(runNoteChatStream).not.toHaveBeenCalled();
  });

  it("질문 생성 RPC 결과가 없으면 운영 오류를 기록하고 500을 반환한다", async () => {
    const client = createSupabaseClientMock({
      rpcData: null,
      rpcError: null,
    });

    vi.mocked(createClient).mockResolvedValue(client as never);

    const response = await POST(
      createRequest({
        conversationId: CONVERSATION_ID,
        content: {
          text: "질문입니다.",
        },
      }),
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "질문 생성에 실패했습니다. 잠시 후 다시 시도해 주세요.",
    });

    expect(reportNoteChatOperationalError).toHaveBeenCalledTimes(1);
    expect(reportNoteChatOperationalError).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: USER_ID,
        context: {
          conversationId: CONVERSATION_ID,
        },
        message: "노트 챗봇 질문 생성 결과를 확인하지 못했습니다.",
        userId: USER_ID,
        error: expect.any(Error),
      }),
    );

    expect(runNoteChatStream).not.toHaveBeenCalled();
  });

  it("정상 요청이면 질문을 생성하고 AI 스트림을 시작한다", async () => {
    const client = createSupabaseClientMock();

    vi.mocked(createClient).mockResolvedValue(client as never);

    const response = await POST(
      createRequest({
        conversationId: CONVERSATION_ID,
        content: {
          text: "질문입니다.",
        },
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe(
      "application/x-ndjson; charset=utf-8",
    );
    expect(response.headers.get("Cache-Control")).toBe(
      "no-cache, no-transform",
    );
    expect(response.headers.get("X-Accel-Buffering")).toBe("no");

    /*
     * ReadableStream의 start() 내부 비동기 실행이 완료될 때까지
     * 응답 본문을 소비합니다.
     */
    await readStream(response);

    expect(client.rpc).toHaveBeenCalledWith("create_note_chat_question", {
      p_agent_id: CHAT_CONFIGURATION.prompt.agent.id,
      p_chat_model_config_id: CHAT_CONFIGURATION.model.id,
      p_content: {
        text: "질문입니다.",
      },
      p_conversation_id: CONVERSATION_ID,
      p_embedding_model_config_id: EMBEDDING_CONFIGURATION.model.id,
      p_prompt_version_id: CHAT_CONFIGURATION.prompt.version.id,
    });

    expect(runNoteChatStream).toHaveBeenCalledTimes(1);
    expect(runNoteChatStream).toHaveBeenCalledWith(
      {
        conversationId: CONVERSATION_ID,
        runId: RUN_ID,
        settings: {
          chat: CHAT_CONFIGURATION,
          queryExpansion: QUERY_EXPANSION_CONFIGURATION,
          embedding: EMBEDDING_CONFIGURATION,
        },
        userId: USER_ID,
        userMessageId: USER_MESSAGE_ID,
      },
      expect.any(Function),
    );

    expect(reportNoteChatOperationalError).not.toHaveBeenCalled();
  });

  it("Run 실행 중 발생한 스트림 이벤트를 NDJSON으로 전달한다", async () => {
    const client = createSupabaseClientMock();

    vi.mocked(createClient).mockResolvedValue(client as never);

    vi.mocked(runNoteChatStream).mockImplementation(
      async (_params, onEvent) => {
        await onEvent({
          type: "start",
          runId: RUN_ID,
          userMessageId: USER_MESSAGE_ID,
        });

        await onEvent({
          type: "text-delta",
          delta: "안녕하세요.",
        });

        await onEvent({
          type: "finish",
          runId: RUN_ID,
          assistantMessageId: ASSISTANT_MESSAGE_ID,
          usedNoteIds: [],
        });

        return RUN_RESULT;
      },
    );

    const response = await POST(
      createRequest({
        conversationId: CONVERSATION_ID,
        content: {
          text: "질문입니다.",
        },
      }),
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
        delta: "안녕하세요.",
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
    const client = createSupabaseClientMock();

    vi.mocked(createClient).mockResolvedValue(client as never);

    vi.mocked(runNoteChatStream).mockImplementation(
      async (_params, onEvent) => {
        await onEvent({
          type: "error",
          message: "답변 생성에 실패했습니다.",
          runId: RUN_ID,
        });

        return RUN_RESULT;
      },
    );

    const response = await POST(
      createRequest({
        conversationId: CONVERSATION_ID,
        content: {
          text: "질문입니다.",
        },
      }),
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
    const client = createSupabaseClientMock();

    vi.mocked(createClient).mockResolvedValue(client as never);

    vi.mocked(runNoteChatStream).mockRejectedValue(
      new Error("unexpected stream error"),
    );

    const response = await POST(
      createRequest({
        conversationId: CONVERSATION_ID,
        content: {
          text: "질문입니다.",
        },
      }),
    );

    const lines = await readStream(response);

    expect(lines).toEqual([
      JSON.stringify({
        message: "답변 생성에 실패했습니다.",
        runId: RUN_ID,
        type: "error",
      }),
    ]);

    expect(reportNoteChatOperationalError).not.toHaveBeenCalled();
  });

  it("Run 실행에서 error 이벤트가 전달된 경우 예외가 발생해도 중복 error 이벤트를 전달하지 않는다", async () => {
    const client = createSupabaseClientMock();

    vi.mocked(createClient).mockResolvedValue(client as never);

    vi.mocked(runNoteChatStream).mockImplementation(
      async (_params, onEvent) => {
        await onEvent({
          type: "error",
          message: "실행 실패",
          runId: RUN_ID,
        });

        throw new Error("after error event");
      },
    );

    const response = await POST(
      createRequest({
        conversationId: CONVERSATION_ID,
        content: {
          text: "질문입니다.",
        },
      }),
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
