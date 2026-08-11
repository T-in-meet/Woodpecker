import { beforeEach, describe, expect, it, vi } from "vitest";

import { AI_RUN_STATUS } from "@/features/ai/chats/constants";

import {
  completeNoteChatRunFailure,
  completeNoteChatRunSuccess,
  markNoteChatRunRunning,
  saveNoteChatExpandedQuery,
} from "../run-persistence";

const createQueryBuilder = (result: {
  data: unknown;
  error: { message: string } | null;
}) => {
  const queryBuilder = {
    update: vi.fn(),
    eq: vi.fn(),
    select: vi.fn(),
    maybeSingle: vi.fn(),
  };

  queryBuilder.update.mockReturnValue(queryBuilder);
  queryBuilder.eq.mockReturnValue(queryBuilder);
  queryBuilder.select.mockReturnValue(queryBuilder);
  queryBuilder.maybeSingle.mockResolvedValue(result);

  return queryBuilder;
};

const createSupabaseMock = (result: {
  data: unknown;
  error: { message: string } | null;
}) => {
  const queryBuilder = createQueryBuilder(result);

  return {
    from: vi.fn().mockReturnValue(queryBuilder),
    rpc: vi.fn(),
    queryBuilder,
  };
};

describe("markNoteChatRunRunning", () => {
  it("pending Run을 running 상태로 변경한다", async () => {
    const supabase = createSupabaseMock({
      data: { id: "run-1" },
      error: null,
    });

    await markNoteChatRunRunning("run-1", {
      supabase,
    });

    expect(supabase.from).toHaveBeenCalledWith("note_chat_runs");
    expect(supabase.queryBuilder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: AI_RUN_STATUS.RUNNING,
      }),
    );
    expect(supabase.queryBuilder.eq).toHaveBeenNthCalledWith(1, "id", "run-1");
    expect(supabase.queryBuilder.eq).toHaveBeenNthCalledWith(
      2,
      "status",
      AI_RUN_STATUS.PENDING,
    );
  });

  it("DB 오류가 발생하면 오류를 발생시킨다", async () => {
    const supabase = createSupabaseMock({
      data: null,
      error: { message: "database error" },
    });

    await expect(
      markNoteChatRunRunning("run-1", {
        supabase,
      }),
    ).rejects.toThrow(
      "Failed to mark note chat run as running: database error",
    );
  });

  it("pending Run을 찾지 못하면 오류를 발생시킨다", async () => {
    const supabase = createSupabaseMock({
      data: null,
      error: null,
    });

    await expect(
      markNoteChatRunRunning("run-1", {
        supabase,
      }),
    ).rejects.toThrow("Pending note chat run not found: run-1");
  });
});

describe("saveNoteChatExpandedQuery", () => {
  it("running Run에 확장 질의를 저장한다", async () => {
    const supabase = createSupabaseMock({
      data: { id: "run-1" },
      error: null,
    });

    await saveNoteChatExpandedQuery(
      {
        runId: "run-1",
        expandedQuery: "확장된 검색 질의",
      },
      {
        supabase,
      },
    );

    expect(supabase.from).toHaveBeenCalledWith("note_chat_runs");
    expect(supabase.queryBuilder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        expanded_query: "확장된 검색 질의",
      }),
    );
    expect(supabase.queryBuilder.eq).toHaveBeenNthCalledWith(1, "id", "run-1");
    expect(supabase.queryBuilder.eq).toHaveBeenNthCalledWith(
      2,
      "status",
      AI_RUN_STATUS.RUNNING,
    );
  });

  it("running Run을 찾지 못하면 오류를 발생시킨다", async () => {
    const supabase = createSupabaseMock({
      data: null,
      error: null,
    });

    await expect(
      saveNoteChatExpandedQuery(
        {
          runId: "run-1",
          expandedQuery: "확장된 검색 질의",
        },
        {
          supabase,
        },
      ),
    ).rejects.toThrow("Running note chat run not found: run-1");
  });
});

describe("completeNoteChatRunSuccess", () => {
  it("성공 완료 RPC를 호출하고 Assistant Message ID를 반환한다", async () => {
    const supabase = createSupabaseMock({
      data: null,
      error: null,
    });

    supabase.rpc.mockResolvedValue({
      data: "assistant-message-1",
      error: null,
    });

    const result = await completeNoteChatRunSuccess(
      {
        runId: "run-1",
        content: "AI 답변",
        usedNoteIds: [],
        sources: [],
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

    expect(result).toBe("assistant-message-1");

    expect(supabase.rpc).toHaveBeenCalledWith(
      "complete_note_chat_run_success",
      {
        p_content: {
          text: "AI 답변",
          usedNoteIds: [],
        },
        p_run_id: "run-1",
        p_sources: [],
        p_usage: {
          inputTokens: 100,
          outputTokens: 50,
          totalTokens: 150,
        },
      },
    );
  });

  it("RPC 오류가 발생하면 오류를 발생시킨다", async () => {
    const supabase = createSupabaseMock({
      data: null,
      error: null,
    });

    supabase.rpc.mockResolvedValue({
      data: null,
      error: { message: "rpc error" },
    });

    await expect(
      completeNoteChatRunSuccess(
        {
          runId: "run-1",
          content: "AI 답변",
          usedNoteIds: [],
          sources: [],
          usage: {
            inputTokens: 100,
            outputTokens: 50,
            totalTokens: 150,
          },
        },
        {
          supabase,
        },
      ),
    ).rejects.toThrow(
      "Failed to complete note chat run successfully: rpc error",
    );
  });

  it("Assistant Message ID가 반환되지 않으면 오류를 발생시킨다", async () => {
    const supabase = createSupabaseMock({
      data: null,
      error: null,
    });

    supabase.rpc.mockResolvedValue({
      data: null,
      error: null,
    });

    await expect(
      completeNoteChatRunSuccess(
        {
          runId: "run-1",
          content: "AI 답변",
          usedNoteIds: [],
          sources: [],
          usage: {
            inputTokens: 100,
            outputTokens: 50,
            totalTokens: 150,
          },
        },
        {
          supabase,
        },
      ),
    ).rejects.toThrow(
      "Note chat success completion returned no assistant message ID: run-1",
    );
  });
});

describe("completeNoteChatRunFailure", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("실패 완료 RPC를 호출한다", async () => {
    const supabase = createSupabaseMock({
      data: null,
      error: null,
    });

    supabase.rpc.mockResolvedValue({
      data: "run-1",
      error: null,
    });

    await completeNoteChatRunFailure(
      {
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

    expect(supabase.rpc).toHaveBeenCalledWith(
      "complete_note_chat_run_failure",
      {
        p_run_id: "run-1",
        p_usage: {
          inputTokens: 100,
          outputTokens: 50,
          totalTokens: 150,
        },
      },
    );
  });

  it("Usage가 null이면 null로 전달한다", async () => {
    const supabase = createSupabaseMock({
      data: null,
      error: null,
    });

    supabase.rpc.mockResolvedValue({
      data: "run-1",
      error: null,
    });

    await completeNoteChatRunFailure(
      {
        runId: "run-1",
        usage: null,
      },
      {
        supabase,
      },
    );

    expect(supabase.rpc).toHaveBeenCalledWith(
      "complete_note_chat_run_failure",
      {
        p_run_id: "run-1",
        p_usage: null,
      },
    );
  });

  it("RPC 오류가 발생하면 오류를 발생시킨다", async () => {
    const supabase = createSupabaseMock({
      data: null,
      error: null,
    });

    supabase.rpc.mockResolvedValue({
      data: null,
      error: { message: "rpc error" },
    });

    await expect(
      completeNoteChatRunFailure(
        {
          runId: "run-1",
          usage: null,
        },
        {
          supabase,
        },
      ),
    ).rejects.toThrow("Failed to complete note chat run as failed: rpc error");
  });

  it("RPC가 다른 Run ID를 반환하면 오류를 발생시킨다", async () => {
    const supabase = createSupabaseMock({
      data: null,
      error: null,
    });

    supabase.rpc.mockResolvedValue({
      data: "run-2",
      error: null,
    });

    await expect(
      completeNoteChatRunFailure(
        {
          runId: "run-1",
          usage: null,
        },
        {
          supabase,
        },
      ),
    ).rejects.toThrow(
      "Note chat failure completion returned an unexpected run ID: run-1",
    );
  });
});
