import { beforeEach, describe, expect, it, vi } from "vitest";

import { AI_RUN_STATUS } from "@/features/ai/chats/constants";

import {
  completeNoteChatRunFailure,
  completeNoteChatRunSuccess,
  createNoteChatRunRecord,
  saveNoteChatExpandedQuery,
  saveNoteChatRunAnswerGeneration,
  saveNoteChatRunQueryEmbedding,
  saveNoteChatRunQueryExpansion,
  saveNoteChatRunSources,
} from "../run-persistence";

/** Supabase query builder mock 결과입니다. */
type QueryResult = {
  /** Supabase data payload입니다. */
  data: unknown;

  /** Supabase error payload입니다. */
  error: { message: string } | null;
};

/** 테스트용 Supabase query builder mock을 생성합니다. */
const createQueryBuilder = (result: QueryResult) => {
  const queryBuilder = {
    eq: vi.fn(),
    insert: vi.fn(),
    maybeSingle: vi.fn(),
    select: vi.fn(),
    update: vi.fn(),
  };

  queryBuilder.eq.mockReturnValue(queryBuilder);
  queryBuilder.insert.mockReturnValue(queryBuilder);
  queryBuilder.select.mockReturnValue(queryBuilder);
  queryBuilder.update.mockReturnValue(queryBuilder);
  queryBuilder.maybeSingle.mockResolvedValue(result);

  return queryBuilder;
};

/**
 * Run persistence가 사용하는 최소 Supabase Client mock을 생성합니다.
 *
 * Assistant Message 저장 RPC는 execution claim 계층으로 이동했으므로
 * Run persistence 테스트 client에는 rpc를 포함하지 않습니다.
 */
const createSupabaseMock = (result: QueryResult) => {
  const queryBuilder = createQueryBuilder(result);

  return {
    from: vi.fn().mockReturnValue(queryBuilder),
    queryBuilder,
  };
};

describe("note chat run persistence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("running Run 감사 기록을 생성한다", async () => {
    const supabase = createSupabaseMock({
      data: { id: "run-1" },
      error: null,
    });

    const result = await createNoteChatRunRecord(
      {
        agentId: "agent-1",
        chatModelConfigId: "chat-model-1",
        embeddingModelConfigId: "embedding-model-1",
        promptVersionId: "prompt-version-1",
        userMessageId: "message-1",
      },
      {
        supabase,
      },
    );

    expect(result).toBe("run-1");
    expect(supabase.from).toHaveBeenCalledWith("note_chat_runs");
    expect(supabase.queryBuilder.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        agent_id: "agent-1",
        chat_model_config_id: "chat-model-1",
        embedding_model_config_id: "embedding-model-1",
        prompt_version_id: "prompt-version-1",
        status: AI_RUN_STATUS.RUNNING,
        user_message_id: "message-1",
      }),
    );
  });

  it("Query Expansion usage와 cost를 저장한다", async () => {
    const supabase = createSupabaseMock({
      data: { id: "run-1" },
      error: null,
    });

    await saveNoteChatRunQueryExpansion(
      {
        modelKey: "openai-gpt-4o-mini",
        runId: "run-1",
        usage: {
          inputTokens: 120,
          outputTokens: 30,
          totalTokens: 150,
        },
      },
      {
        supabase,
      },
    );

    expect(supabase.queryBuilder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        query_expansion_cost_usd: expect.any(Number),
        query_expansion_usage: {
          inputTokens: 120,
          outputTokens: 30,
          totalTokens: 150,
        },
      }),
    );
  });

  it("Query Embedding usage와 cost를 저장한다", async () => {
    const supabase = createSupabaseMock({
      data: { id: "run-1" },
      error: null,
    });

    await saveNoteChatRunQueryEmbedding(
      {
        modelKey: "openai-text-embedding-3-small",
        runId: "run-1",
        usage: {
          inputTokens: 100,
          outputTokens: 0,
          totalTokens: 100,
        },
      },
      {
        supabase,
      },
    );

    expect(supabase.queryBuilder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        query_embedding_cost_usd: expect.any(Number),
        query_embedding_usage: {
          inputTokens: 100,
          outputTokens: 0,
          totalTokens: 100,
        },
      }),
    );
  });

  it("Answer Generation usage와 cost를 저장한다", async () => {
    const supabase = createSupabaseMock({
      data: { id: "run-1" },
      error: null,
    });

    await saveNoteChatRunAnswerGeneration(
      {
        modelKey: "openai-gpt-4o-mini",
        runId: "run-1",
        usage: {
          inputTokens: 100,
          outputTokens: 50,
          totalTokens: 150,
        },
      },
      {
        supabase,
      },
    );

    expect(supabase.queryBuilder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        answer_generation_cost_usd: expect.any(Number),
        answer_generation_usage: {
          inputTokens: 100,
          outputTokens: 50,
          totalTokens: 150,
        },
      }),
    );
  });

  it("확장 질의와 source snapshot을 running Run에 저장한다", async () => {
    const supabase = createSupabaseMock({
      data: { id: "run-1" },
      error: null,
    });

    await saveNoteChatExpandedQuery(
      {
        expandedQuery: "확장된 검색 질의",
        runId: "run-1",
      },
      {
        supabase,
      },
    );

    await saveNoteChatRunSources(
      {
        runId: "run-1",
        sources: [{ noteId: "note-1", title: "Note", type: "note" }],
      },
      {
        supabase,
      },
    );

    expect(supabase.queryBuilder.update).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        expanded_query: "확장된 검색 질의",
      }),
    );

    expect(supabase.queryBuilder.update).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        sources: [{ noteId: "note-1", title: "Note", type: "note" }],
      }),
    );
  });

  it("Run 성공 완료는 assistant message와 sources를 감사 기록에 저장한다", async () => {
    const supabase = createSupabaseMock({
      data: { id: "run-1" },
      error: null,
    });

    await completeNoteChatRunSuccess(
      {
        assistantMessageId: "assistant-message-1",
        runId: "run-1",
        sources: [],
      },
      {
        supabase,
      },
    );

    expect(supabase.queryBuilder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        assistant_message_id: "assistant-message-1",
        completed_at: expect.any(String),
        sources: [],
        status: AI_RUN_STATUS.SUCCEEDED,
      }),
    );
  });

  it("Run 실패 완료는 실패 메시지를 감사 기록에 저장한다", async () => {
    const supabase = createSupabaseMock({
      data: { id: "run-1" },
      error: null,
    });

    await completeNoteChatRunFailure(
      {
        failureMessage: "provider failed",
        runId: "run-1",
      },
      {
        supabase,
      },
    );

    expect(supabase.queryBuilder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        completed_at: expect.any(String),
        failure_message: "provider failed",
        status: AI_RUN_STATUS.FAILED,
      }),
    );
  });

  it("Run 갱신은 running 상태인 Run만 대상으로 한다", async () => {
    const supabase = createSupabaseMock({
      data: { id: "run-1" },
      error: null,
    });

    await saveNoteChatExpandedQuery(
      {
        expandedQuery: "확장된 검색 질의",
        runId: "run-1",
      },
      {
        supabase,
      },
    );

    expect(supabase.queryBuilder.eq).toHaveBeenNthCalledWith(1, "id", "run-1");
    expect(supabase.queryBuilder.eq).toHaveBeenNthCalledWith(
      2,
      "status",
      AI_RUN_STATUS.RUNNING,
    );
  });

  it("Run 생성 중 DB 오류가 발생하면 실패한다", async () => {
    const supabase = createSupabaseMock({
      data: null,
      error: {
        message: "insert failed",
      },
    });

    await expect(
      createNoteChatRunRecord(
        {
          agentId: "agent-1",
          chatModelConfigId: "chat-model-1",
          embeddingModelConfigId: "embedding-model-1",
          promptVersionId: "prompt-version-1",
          userMessageId: "message-1",
        },
        {
          supabase,
        },
      ),
    ).rejects.toThrow("Failed to create note chat run record: insert failed");
  });

  it("Run 생성 결과 row가 없으면 실패한다", async () => {
    const supabase = createSupabaseMock({
      data: null,
      error: null,
    });

    await expect(
      createNoteChatRunRecord(
        {
          agentId: "agent-1",
          chatModelConfigId: "chat-model-1",
          embeddingModelConfigId: "embedding-model-1",
          promptVersionId: "prompt-version-1",
          userMessageId: "message-1",
        },
        {
          supabase,
        },
      ),
    ).rejects.toThrow("Note chat run record insert returned no row.");
  });

  it("Run 갱신 중 DB 오류가 발생하면 실패한다", async () => {
    const supabase = createSupabaseMock({
      data: null,
      error: {
        message: "update failed",
      },
    });

    await expect(
      saveNoteChatExpandedQuery(
        {
          expandedQuery: "확장된 검색 질의",
          runId: "run-1",
        },
        {
          supabase,
        },
      ),
    ).rejects.toThrow("Failed to update note chat run: update failed");
  });

  it("running Run을 찾지 못하면 오류를 발생시킨다", async () => {
    const supabase = createSupabaseMock({
      data: null,
      error: null,
    });

    await expect(
      saveNoteChatExpandedQuery(
        {
          expandedQuery: "확장된 검색 질의",
          runId: "run-1",
        },
        {
          supabase,
        },
      ),
    ).rejects.toThrow("Running note chat run not found: run-1");
  });
});
