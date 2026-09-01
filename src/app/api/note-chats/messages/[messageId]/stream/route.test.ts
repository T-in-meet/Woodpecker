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
import {
  resolveAiRuntimeChatConfiguration,
  resolveAiRuntimeEmbeddingConfiguration,
} from "@/features/ai/runtimes";
import { markAiOperationalErrorAsReported } from "@/features/ai/utils/report-ai-operational-error";
import {
  NOTE_CHAT_AI_FEATURE_KEY,
  NOTE_CHAT_AI_ROLE_KEY,
} from "@/features/note-chats/constants/ai";
import { NOTE_CHAT_DAILY_EXECUTION_LIMIT_ERROR_CODE } from "@/features/note-chats/constants/execution";
import {
  claimNoteChatExecution,
  completeNoteChatExecutionClaim,
  NOTE_CHAT_EXECUTION_CLAIM_STATUS,
} from "@/features/note-chats/execution/execution-claim-persistence";
import { createNoteChatRunRecord } from "@/features/note-chats/execution/run-persistence";
import { runNoteChatStream } from "@/features/note-chats/stream/run-note-chat-stream";
import { reportNoteChatOperationalError } from "@/features/note-chats/utils/report-operational-error";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

import { POST } from "./route";

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

vi.mock("@/features/note-chats/execution/run-persistence", () => ({
  createNoteChatRunRecord: vi.fn(),
}));

vi.mock("@/features/note-chats/utils/report-operational-error", () => ({
  reportNoteChatOperationalError: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(),
}));

const MESSAGE_ID = "550e8400-e29b-41d4-a716-446655440001";
const CONVERSATION_ID = "550e8400-e29b-41d4-a716-446655440002";
const RUN_ID = "550e8400-e29b-41d4-a716-446655440003";
const USER_MESSAGE_ID = MESSAGE_ID;
const ASSISTANT_MESSAGE_ID = "550e8400-e29b-41d4-a716-446655440004";
const CLAIM_ID = "550e8400-e29b-41d4-a716-446655440005";

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
  featureKey: NOTE_RETRIEVAL_AI_FEATURE_KEY,
  roleKey: NOTE_RETRIEVAL_AI_ROLE_KEY,
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
  conversation_id: CONVERSATION_ID,
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

type RpcError = {
  code: string;
  details: string | null;
  hint: string | null;
  message: string;
};

type SupabaseClientMockOptions = {
  targetMessage?: {
    conversation_id: string;
    role: "user" | "assistant";
  } | null;
  targetMessageError?: Error | null;
  updateResult?: typeof UPDATED_RESULT | null;
  updateError?: Error | RpcError | null;
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

  const select = vi.fn().mockReturnValue({
    eq: vi.fn().mockReturnValue({
      maybeSingle: vi.fn().mockResolvedValue({
        data: targetMessage,
        error: targetMessageError,
      }),
    }),
  });

  const from = vi.fn().mockReturnValue({
    select,
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
  };
}

function createAdminClientMock(options: SupabaseClientMockOptions = {}) {
  const updateResult =
    options.updateResult === undefined ? UPDATED_RESULT : options.updateResult;

  const updateError = options.updateError ?? null;

  return {
    rpc: vi.fn().mockReturnValue({
      single: vi.fn().mockResolvedValue({
        data: updateResult,
        error: updateError,
      }),
    }),
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

  vi.mocked(createNoteChatRunRecord).mockResolvedValue(RUN_ID);

  vi.mocked(runNoteChatStream).mockResolvedValue(RUN_RESULT);

  const client = createSupabaseClientMock();
  const adminClient = createAdminClientMock();

  vi.mocked(createClient).mockResolvedValue(client as never);
  vi.mocked(createAdminClient).mockReturnValue(adminClient as never);
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

  it("Claim이 일일 실행 제한 초과를 반환하면 기능 데이터를 수정하기 전에 429를 반환한다", async () => {
    vi.mocked(claimNoteChatExecution).mockResolvedValue({
      claimId: null,
      status: NOTE_CHAT_EXECUTION_CLAIM_STATUS.DAILY_LIMIT_EXCEEDED,
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

    expect(response.status).toBe(429);

    await expect(response.json()).resolves.toEqual({
      code: NOTE_CHAT_DAILY_EXECUTION_LIMIT_ERROR_CODE,
      error: "오늘 사용할 수 있는 노트 챗봇 횟수를 모두 사용했습니다.",
    });

    expect(reportNoteChatOperationalError).not.toHaveBeenCalled();
    expect(createNoteChatRunRecord).not.toHaveBeenCalled();
    expect(runNoteChatStream).not.toHaveBeenCalled();
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

    const client = createSupabaseClientMock();

    const adminClient = createAdminClientMock({
      updateError: error,
    });

    vi.mocked(createClient).mockResolvedValue(client as never);
    vi.mocked(createAdminClient).mockReturnValue(adminClient as never);

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

    expect(completeNoteChatExecutionClaim).toHaveBeenCalledWith({
      claimId: CLAIM_ID,
      status: "failed",
    });

    expect(runNoteChatStream).not.toHaveBeenCalled();
  });

  it("사용자 메시지 수정 RPC 결과가 없으면 운영 오류를 기록하고 500을 반환한다", async () => {
    const client = createSupabaseClientMock();

    const adminClient = createAdminClientMock({
      updateResult: null,
    });

    vi.mocked(createClient).mockResolvedValue(client as never);
    vi.mocked(createAdminClient).mockReturnValue(adminClient as never);

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

    expect(completeNoteChatExecutionClaim).toHaveBeenCalledWith({
      claimId: CLAIM_ID,
      status: "failed",
    });

    expect(runNoteChatStream).not.toHaveBeenCalled();
  });

  it("Claim을 선점한 뒤 사용자 메시지 수정 RPC를 호출한다", async () => {
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

    const adminClient = vi.mocked(createAdminClient).mock.results[0]
      ?.value as ReturnType<typeof createAdminClientMock>;

    expect(claimNoteChatExecution).toHaveBeenCalledWith({
      conversationId: CONVERSATION_ID,
      userId: USER.id,
    });

    expect(adminClient.rpc).toHaveBeenCalledWith(
      "update_note_chat_user_message",
      {
        p_content: {
          text: "수정된 질문",
        },
        p_message_id: MESSAGE_ID,
        p_user_id: USER.id,
      },
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

    const adminClient = vi.mocked(createAdminClient).mock.results[0]
      ?.value as ReturnType<typeof createAdminClientMock>;

    expect(adminClient.rpc).toHaveBeenCalledWith(
      "update_note_chat_user_message",
      {
        p_content: {
          text: "수정된 질문",
        },
        p_message_id: MESSAGE_ID,
        p_user_id: USER.id,
      },
    );

    expect(createNoteChatRunRecord).toHaveBeenCalledWith({
      agentId: CHAT_CONFIGURATION.prompt.agent.id,
      chatModelConfigId: CHAT_CONFIGURATION.model.id,
      embeddingModelConfigId: EMBEDDING_CONFIGURATION.model.id,
      promptVersionId: CHAT_CONFIGURATION.prompt.version.id,
      userMessageId: USER_MESSAGE_ID,
    });

    expect(resolveAiRuntimeEmbeddingConfiguration).toHaveBeenCalledWith({
      featureKey: NOTE_RETRIEVAL_AI_FEATURE_KEY,
      roleKey: NOTE_RETRIEVAL_AI_ROLE_KEY,
    });

    expect(runNoteChatStream).toHaveBeenCalledWith(
      expect.objectContaining({
        claimId: CLAIM_ID,
        conversationId: CONVERSATION_ID,
        runId: RUN_ID,
        userId: USER.id,
        userMessageId: USER_MESSAGE_ID,
      }),
      expect.any(Function),
    );
  });

  it("Run 생성 실패는 운영 오류로 기록하고 runId 없이 AI 스트림을 계속한다", async () => {
    const runCreateError = new Error("run create failed");

    vi.mocked(createNoteChatRunRecord).mockRejectedValue(runCreateError);

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

    await readStream(response);

    expect(reportNoteChatOperationalError).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: USER.id,
        context: {
          conversationId: CONVERSATION_ID,
          userMessageId: USER_MESSAGE_ID,
        },
        error: runCreateError,
        errorCode: "NOTE_CHAT_RUN_CREATE_FAILED",
        userId: USER.id,
      }),
    );

    expect(runNoteChatStream).toHaveBeenCalledWith(
      expect.objectContaining({
        claimId: CLAIM_ID,
        runId: null,
        userMessageId: USER_MESSAGE_ID,
      }),
      expect.any(Function),
    );
  });

  it("Route lifecycle 이벤트와 Run 스트림 이벤트를 NDJSON으로 전달한다", async () => {
    vi.mocked(runNoteChatStream).mockImplementation(
      async (_params, onEvent) => {
        await onEvent({
          type: "text-delta",
          delta: "수정된 답변입니다.",
        });

        return RUN_RESULT;
      },
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

    const lines = await readStream(response);
    const events = lines.map((line) => JSON.parse(line));

    expect(events).toEqual([
      {
        runId: RUN_ID,
        type: "start",
        userMessageId: USER_MESSAGE_ID,
      },
      {
        type: "text-delta",
        delta: "수정된 답변입니다.",
      },
      {
        assistantMessageId: ASSISTANT_MESSAGE_ID,
        runId: RUN_ID,
        type: "finish",
        usedNoteIds: [],
      },
    ]);
  });

  it("Run 실행이 실패하면 start 이후 기본 error 이벤트를 전달한다", async () => {
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
    const events = lines.map((line) => JSON.parse(line));

    expect(events).toEqual([
      {
        runId: RUN_ID,
        type: "start",
        userMessageId: USER_MESSAGE_ID,
      },
      {
        message: "답변 생성에 실패했습니다.",
        runId: RUN_ID,
        type: "error",
      },
    ]);
  });

  it("AI 실행 성공 후 finish 이벤트 전송이 실패해도 실행 성공을 실패로 되돌리지 않는다", async () => {
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

      await vi.waitFor(() => {
        expect(reportNoteChatOperationalError).toHaveBeenCalledWith(
          expect.objectContaining({
            actorUserId: USER.id,
            context: {
              conversationId: CONVERSATION_ID,
              eventType: "finish",
              runId: RUN_ID,
              userMessageId: USER_MESSAGE_ID,
            },
            error: sendError,
            errorCode: "NOTE_CHAT_STREAM_EVENT_SEND_FAILED",
            operation: "send_stream_event",
            userId: USER.id,
          }),
        );
      });

      expect(runNoteChatStream).toHaveBeenCalledTimes(1);

      expect(completeNoteChatExecutionClaim).not.toHaveBeenCalled();
    } finally {
      enqueueSpy.mockRestore();
    }
  });
});
