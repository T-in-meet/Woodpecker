import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const getLegalAcceptanceRequiredPathMock = vi.hoisted(() => vi.fn());

vi.mock("@/features/auth/lib/userAgreements", () => ({
  getLegalAcceptanceRequiredPath: getLegalAcceptanceRequiredPathMock,
}));

import {
  NOTE_RETRIEVAL_AI_FEATURE_KEY,
  NOTE_RETRIEVAL_AI_ROLE_KEY,
} from "@/features/ai/rags/note/constants/runtime";
import { createAiRun } from "@/features/ai/runs/persistence";
import type { AiRunPersistenceHandle } from "@/features/ai/runs/types";
import {
  resolveAiRuntimeChatConfiguration,
  resolveAiRuntimeEmbeddingConfiguration,
} from "@/features/ai/runtimes";
import { markAiOperationalErrorAsReported } from "@/features/ai/utils/report-ai-operational-error";
import { NOTE_CHAT_DAILY_EXECUTION_LIMIT_ERROR_CODE } from "@/features/note-chats/constants/execution";
import {
  claimNoteChatExecution,
  completeNoteChatExecutionClaim,
  NOTE_CHAT_EXECUTION_CLAIM_STATUS,
} from "@/features/note-chats/execution/execution-claim-persistence";
import type { RunNoteChatStreamResult } from "@/features/note-chats/stream/run-note-chat-stream";
import { runNoteChatStream } from "@/features/note-chats/stream/run-note-chat-stream";
import { reportNoteChatOperationalError } from "@/features/note-chats/utils/report-operational-error";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

import { POST } from "./route";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(),
}));

vi.mock("@/features/ai/runtimes", () => ({
  resolveAiRuntimeChatConfiguration: vi.fn(),
  resolveAiRuntimeEmbeddingConfiguration: vi.fn(),
}));

vi.mock("@/features/note-chats/stream/run-note-chat-stream", () => ({
  runNoteChatStream: vi.fn(),
}));

vi.mock("@/features/note-chats/execution/execution-claim-persistence", () => ({
  claimNoteChatExecution: vi.fn(),
  completeNoteChatExecutionClaim: vi.fn(),
  NOTE_CHAT_EXECUTION_CLAIM_COMPLETION_STATUS: {
    FAILED: "failed",
    STALE: "stale",
    SUCCEEDED: "succeeded",
  },
  NOTE_CHAT_EXECUTION_CLAIM_STATUS: {
    CLAIMED: "claimed",
    DAILY_LIMIT_EXCEEDED: "daily_limit_exceeded",
    DUPLICATE: "duplicate",
  },
}));

vi.mock("@/features/ai/runs/persistence", () => ({
  createAiRun: vi.fn(),
}));

vi.mock("@/features/note-chats/utils/report-operational-error", () => ({
  reportNoteChatOperationalError: vi.fn(),
}));

const USER_ID = "550e8400-e29b-41d4-a716-446655440000";
const CONVERSATION_ID = "550e8400-e29b-41d4-a716-446655440001";
const RUN_ID = "550e8400-e29b-41d4-a716-446655440002";
const USER_MESSAGE_ID = "550e8400-e29b-41d4-a716-446655440003";
const ASSISTANT_MESSAGE_ID = "550e8400-e29b-41d4-a716-446655440004";
const CLAIM_ID = "550e8400-e29b-41d4-a716-446655440005";

const AI_RUN: AiRunPersistenceHandle = {
  id: RUN_ID,
  userId: USER_ID,
  featureType: "note-chat",
  startedAt: "2026-09-05T00:00:00.000Z",
  createPersisted: true,
};

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
  featureKey: NOTE_RETRIEVAL_AI_FEATURE_KEY,
  roleKey: NOTE_RETRIEVAL_AI_ROLE_KEY,
  model: {
    id: "550e8400-e29b-41d4-a716-446655440020",
    model: "text-embedding-test",
    provider: "openai",
  },
};

const CREATED_QUESTION = USER_MESSAGE_ID;

const RUN_RESULT: RunNoteChatStreamResult = {
  assistantMessageId: ASSISTANT_MESSAGE_ID,
  content: "답변입니다.",
  usedNoteIds: [],
};

const createSupabaseClientMock = ({
  user = {
    id: USER_ID,
    email_confirmed_at: "2026-08-11T00:00:00.000Z",
  },
  userError = null,
}: {
  user?: {
    id: string;
    email_confirmed_at: string | null;
  } | null;
  userError?: Error | null;
} = {}) => ({
  auth: {
    getUser: vi.fn().mockResolvedValue({
      data: {
        user,
      },
      error: userError,
    }),
  },
});

type RpcError = {
  code: string;
  details: string | null;
  hint: string | null;
  message: string;
};

const createAdminClientMock = ({
  rpcData = CREATED_QUESTION,
  rpcError = null,
}: {
  rpcData?: typeof CREATED_QUESTION | null;
  rpcError?: Error | RpcError | null;
} = {}) => {
  const rpc = vi.fn().mockResolvedValue({
    data: rpcData,
    error: rpcError,
  });

  return {
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
    getLegalAcceptanceRequiredPathMock.mockReset().mockResolvedValue(null);
    vi.clearAllMocks();

    vi.mocked(reportNoteChatOperationalError).mockResolvedValue(undefined);

    vi.mocked(resolveAiRuntimeChatConfiguration)
      .mockResolvedValueOnce(CHAT_CONFIGURATION as never)
      .mockResolvedValueOnce(QUERY_EXPANSION_CONFIGURATION as never);

    vi.mocked(resolveAiRuntimeEmbeddingConfiguration).mockResolvedValue(
      EMBEDDING_CONFIGURATION as never,
    );

    vi.mocked(claimNoteChatExecution).mockResolvedValue({
      claimId: CLAIM_ID,
      status: NOTE_CHAT_EXECUTION_CLAIM_STATUS.CLAIMED,
    });

    vi.mocked(completeNoteChatExecutionClaim).mockResolvedValue(undefined);

    vi.mocked(createAiRun).mockResolvedValue(AI_RUN);

    vi.mocked(runNoteChatStream).mockResolvedValue(RUN_RESULT);

    const client = createSupabaseClientMock();
    const adminClient = createAdminClientMock();

    vi.mocked(createClient).mockResolvedValue(client as never);
    vi.mocked(createAdminClient).mockReturnValue(adminClient as never);
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
    expect(createAdminClient).not.toHaveBeenCalled();
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

    expect(createAdminClient).not.toHaveBeenCalled();
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

    expect(reportNoteChatOperationalError).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: USER_ID,
        error: configurationError,
        errorCode: expect.any(String),
        message: "노트 챗봇 AI 실행 설정 조회에 실패했습니다.",
        userId: USER_ID,
      }),
    );

    expect(createAdminClient).not.toHaveBeenCalled();
    expect(runNoteChatStream).not.toHaveBeenCalled();
  });

  it("이미 AI Foundation에서 보고된 Runtime Configuration 실패는 중복 기록하지 않는다", async () => {
    const client = createSupabaseClientMock();

    vi.mocked(createClient).mockResolvedValue(client as never);

    const configurationError = markAiOperationalErrorAsReported(
      new Error("reported configuration load failed"),
    );

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

    expect(reportNoteChatOperationalError).not.toHaveBeenCalled();
    expect(createAdminClient).not.toHaveBeenCalled();
    expect(runNoteChatStream).not.toHaveBeenCalled();
  });

  it("질문 생성 RPC가 실패하면 운영 오류를 기록하고 500을 반환한다", async () => {
    const createError = new Error("question create failed");

    const client = createSupabaseClientMock();

    const adminClient = createAdminClientMock({
      rpcData: null,
      rpcError: createError,
    });

    vi.mocked(createClient).mockResolvedValue(client as never);
    vi.mocked(createAdminClient).mockReturnValue(adminClient as never);

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

    expect(adminClient.rpc).toHaveBeenCalledWith("create_note_chat_question", {
      p_content: {
        text: "질문입니다.",
      },
      p_conversation_id: CONVERSATION_ID,
      p_user_id: USER_ID,
    });

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

    expect(completeNoteChatExecutionClaim).toHaveBeenCalledWith({
      claimId: CLAIM_ID,
      status: "failed",
    });
    expect(runNoteChatStream).not.toHaveBeenCalled();
  });

  it("질문 생성 RPC 결과가 없으면 운영 오류를 기록하고 500을 반환한다", async () => {
    const client = createSupabaseClientMock();

    const adminClient = createAdminClientMock({
      rpcData: null,
      rpcError: null,
    });

    vi.mocked(createClient).mockResolvedValue(client as never);
    vi.mocked(createAdminClient).mockReturnValue(adminClient as never);

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

    expect(completeNoteChatExecutionClaim).toHaveBeenCalledWith({
      claimId: CLAIM_ID,
      status: "failed",
    });
    expect(runNoteChatStream).not.toHaveBeenCalled();
  });

  it("Claim이 일일 실행 제한 초과를 반환하면 기능 데이터를 만들기 전에 429를 반환한다", async () => {
    const client = createSupabaseClientMock();

    vi.mocked(claimNoteChatExecution).mockResolvedValue({
      claimId: null,
      status: NOTE_CHAT_EXECUTION_CLAIM_STATUS.DAILY_LIMIT_EXCEEDED,
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

    expect(response.status).toBe(429);

    await expect(response.json()).resolves.toEqual({
      code: NOTE_CHAT_DAILY_EXECUTION_LIMIT_ERROR_CODE,
      error: "오늘 사용할 수 있는 노트 챗봇 횟수를 모두 사용했습니다.",
    });

    expect(reportNoteChatOperationalError).not.toHaveBeenCalled();
    expect(createAiRun).not.toHaveBeenCalled();
    expect(runNoteChatStream).not.toHaveBeenCalled();
  });

  it("Claim을 선점한 뒤 질문 생성 RPC를 호출한다", async () => {
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

    await readStream(response);

    const adminClient = vi.mocked(createAdminClient).mock.results[0]
      ?.value as ReturnType<typeof createAdminClientMock>;

    expect(claimNoteChatExecution).toHaveBeenCalledWith({
      conversationId: CONVERSATION_ID,
      userId: USER_ID,
    });

    expect(adminClient.rpc).toHaveBeenCalledWith("create_note_chat_question", {
      p_content: {
        text: "질문입니다.",
      },
      p_conversation_id: CONVERSATION_ID,
      p_user_id: USER_ID,
    });
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

    const adminClient = vi.mocked(createAdminClient).mock.results[0]
      ?.value as ReturnType<typeof createAdminClientMock>;

    expect(adminClient.rpc).toHaveBeenCalledWith("create_note_chat_question", {
      p_content: {
        text: "질문입니다.",
      },
      p_conversation_id: CONVERSATION_ID,
      p_user_id: USER_ID,
    });

    expect(createAiRun).toHaveBeenCalledWith(
      expect.objectContaining({
        featureType: "note-chat",
        userId: USER_ID,
      }),
    );

    expect(resolveAiRuntimeEmbeddingConfiguration).toHaveBeenCalledWith({
      featureKey: NOTE_RETRIEVAL_AI_FEATURE_KEY,
      roleKey: NOTE_RETRIEVAL_AI_ROLE_KEY,
    });

    expect(runNoteChatStream).toHaveBeenCalledTimes(1);

    expect(runNoteChatStream).toHaveBeenCalledWith(
      expect.objectContaining({
        claimId: CLAIM_ID,
        conversationId: CONVERSATION_ID,
        aiRun: AI_RUN,
        settings: {
          chat: CHAT_CONFIGURATION,
          queryExpansion: QUERY_EXPANSION_CONFIGURATION,
          embedding: EMBEDDING_CONFIGURATION,
        },
        userId: USER_ID,
        userMessageId: USER_MESSAGE_ID,
      }),
      expect.any(Function),
    );

    expect(reportNoteChatOperationalError).not.toHaveBeenCalled();
  });

  it("AI Run 초기 persistence 실패에도 같은 Run identity로 AI 스트림을 계속한다", async () => {
    const client = createSupabaseClientMock();

    vi.mocked(createClient).mockResolvedValue(client as never);

    const unpersistedAiRun: AiRunPersistenceHandle = {
      ...AI_RUN,
      createPersisted: false,
    };

    vi.mocked(createAiRun).mockResolvedValue(unpersistedAiRun);

    const response = await POST(
      createRequest({
        conversationId: CONVERSATION_ID,
        content: {
          text: "질문입니다.",
        },
      }),
    );

    expect(response.status).toBe(200);

    await readStream(response);

    expect(runNoteChatStream).toHaveBeenCalledWith(
      expect.objectContaining({
        claimId: CLAIM_ID,
        aiRun: unpersistedAiRun,
        userMessageId: USER_MESSAGE_ID,
      }),
      expect.any(Function),
    );
  });

  it("Route lifecycle 이벤트와 Run 스트림 이벤트를 NDJSON으로 전달한다", async () => {
    const client = createSupabaseClientMock();

    vi.mocked(createClient).mockResolvedValue(client as never);

    vi.mocked(runNoteChatStream).mockImplementation(
      async (_params, onEvent) => {
        await onEvent({
          type: "text-delta",
          delta: "안녕하세요.",
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
    const events = lines.map((line) => JSON.parse(line));

    expect(events).toEqual([
      {
        type: "start",
        userMessageId: USER_MESSAGE_ID,
      },
      {
        type: "text-delta",
        delta: "안녕하세요.",
      },
      {
        type: "finish",
        assistantMessageId: ASSISTANT_MESSAGE_ID,
        usedNoteIds: [],
      },
    ]);
  });

  it("AI 실행 성공 후 finish 이벤트 전송이 실패해도 실행 성공을 실패로 되돌리지 않는다", async () => {
    const client = createSupabaseClientMock();

    vi.mocked(createClient).mockResolvedValue(client as never);

    /*
     * AI 실행 자체는 정상적으로 성공합니다.
     *
     * Assistant Message 저장과 Claim succeeded 전환은
     * runNoteChatStream 내부에서 이미 끝났다고 보는 시점입니다.
     */
    vi.mocked(runNoteChatStream).mockResolvedValue(RUN_RESULT);

    const sendError = new Error("finish event send failed");
    const originalEnqueue = ReadableStreamDefaultController.prototype.enqueue;

    const enqueueSpy = vi
      .spyOn(ReadableStreamDefaultController.prototype, "enqueue")
      .mockImplementation(function (
        this: ReadableStreamDefaultController<Uint8Array>,
        chunk: Uint8Array,
      ) {
        const payload = new TextDecoder().decode(chunk);

        if (payload.includes('"type":"finish"')) {
          throw sendError;
        }

        return originalEnqueue.call(this, chunk);
      });

    try {
      const response = await POST(
        createRequest({
          conversationId: CONVERSATION_ID,
          content: {
            text: "질문입니다.",
          },
        }),
      );

      expect(response.status).toBe(200);

      /*
       * ReadableStream start()에서 실행한 비동기 작업이
       * finish 전송 실패와 operational error 기록까지 완료될 때까지 기다립니다.
       */
      await vi.waitFor(() => {
        expect(reportNoteChatOperationalError).toHaveBeenCalledWith(
          expect.objectContaining({
            actorUserId: USER_ID,
            context: {
              conversationId: CONVERSATION_ID,
              eventType: "finish",
              aiRunId: RUN_ID,
              userMessageId: USER_MESSAGE_ID,
            },
            error: sendError,
            errorCode: "NOTE_CHAT_STREAM_EVENT_SEND_FAILED",
            message: "노트 챗봇 스트림 이벤트 전송에 실패했습니다.",
            operation: "send_stream_event",
            stage: "execution",
            userId: USER_ID,
          }),
        );
      });

      /*
       * AI 실행은 정상적으로 한 번 완료됐습니다.
       */
      expect(runNoteChatStream).toHaveBeenCalledTimes(1);

      /*
       * finish는 AI 실행이 성공한 이후의 응답 전달 단계입니다.
       *
       * 따라서 전송 실패 때문에 이미 succeeded로 확정된 Claim을
       * failed로 다시 완료하려 해서는 안 됩니다.
       */
      expect(completeNoteChatExecutionClaim).not.toHaveBeenCalled();
    } finally {
      enqueueSpy.mockRestore();
    }
  });

  it("start 이벤트 전송과 운영 오류 보고가 모두 실패해도 AI 실행을 계속한다", async () => {
    const client = createSupabaseClientMock();

    vi.mocked(createClient).mockResolvedValue(client as never);

    /*
     * 스트림 전송 실패 기록까지 실패하는 상황을 재현합니다.
     *
     * 이 오류는 AI execution으로 전파되지 않아야 하며,
     * 이미 생성된 Claim을 고아 상태로 남기지 않도록 실행 본문은 계속 호출되어야 합니다.
     */
    vi.mocked(reportNoteChatOperationalError).mockRejectedValue(
      new Error("operational error report failed"),
    );

    vi.mocked(runNoteChatStream).mockResolvedValue(RUN_RESULT);

    const sendError = new Error("start event send failed");
    const originalEnqueue = ReadableStreamDefaultController.prototype.enqueue;

    const enqueueSpy = vi
      .spyOn(ReadableStreamDefaultController.prototype, "enqueue")
      .mockImplementation(function (
        this: ReadableStreamDefaultController<Uint8Array>,
        chunk: Uint8Array,
      ) {
        const payload = new TextDecoder().decode(chunk);

        if (payload.includes('"type":"start"')) {
          throw sendError;
        }

        return originalEnqueue.call(this, chunk);
      });

    try {
      const response = await POST(
        createRequest({
          conversationId: CONVERSATION_ID,
          content: {
            text: "질문입니다.",
          },
        }),
      );

      expect(response.status).toBe(200);
      expect(await readStream(response)).toEqual([]);

      /*
       * start 전달 실패가 try 바깥에서 발생해도
       * runNoteChatStream 호출은 건너뛰면 안 됩니다.
       */
      expect(runNoteChatStream).toHaveBeenCalledTimes(1);

      /*
       * 전송 실패 보고는 시도하지만,
       * 보고 실패가 AI execution 상태 정리로 전파되지는 않습니다.
       */
      expect(reportNoteChatOperationalError).toHaveBeenCalledWith(
        expect.objectContaining({
          context: expect.objectContaining({
            eventType: "start",
          }),
          error: sendError,
          errorCode: "NOTE_CHAT_STREAM_EVENT_SEND_FAILED",
          operation: "send_stream_event",
        }),
      );
      expect(completeNoteChatExecutionClaim).not.toHaveBeenCalled();
    } finally {
      enqueueSpy.mockRestore();
    }
  });

  it("Run 실행이 실패하면 start 이후 기본 error 이벤트를 전달한다", async () => {
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
        type: "start",
        userMessageId: USER_MESSAGE_ID,
      }),
      JSON.stringify({
        message: "답변 생성에 실패했습니다.",
        type: "error",
      }),
    ]);

    expect(reportNoteChatOperationalError).not.toHaveBeenCalled();
  });
});
