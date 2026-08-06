import { describe, expect, it, vi } from "vitest";

import { AI_RUN_STATUS } from "@/features/ai/chats/constants";

import {
  completeNoteChatRunFailure,
  completeNoteChatRunSuccess,
  markNoteChatRunRunning,
} from "../run-persistence";

const RUN_ID = "11111111-1111-4111-8111-111111111111";
const ASSISTANT_MESSAGE_ID = "22222222-2222-4222-8222-222222222222";

const USAGE = {
  inputTokens: 10,
  outputTokens: 20,
  totalTokens: 30,
};

/**
 * Run 상태 변경 테스트용 Supabase Client를 생성합니다.
 */
function createRunUpdateClientMock(result: {
  data: { id: string } | null;
  error: { message: string } | null;
}) {
  const maybeSingle = vi.fn().mockResolvedValue(result);

  const query = {
    update: vi.fn(),
    eq: vi.fn(),
    select: vi.fn(),
    maybeSingle,
  };

  query.update.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.select.mockReturnValue(query);

  const from = vi.fn().mockReturnValue(query);

  return {
    client: {
      from,
    } as never,
    from,
    query,
  };
}

/**
 * RPC 테스트용 Supabase Client를 생성합니다.
 */
function createRpcClientMock(result: {
  data: unknown;
  error: { message: string } | null;
}) {
  const rpc = vi.fn().mockResolvedValue(result);

  return {
    client: {
      rpc,
    } as never,
    rpc,
  };
}

describe("markNoteChatRunRunning", () => {
  it("pending Run을 running 상태로 변경한다", async () => {
    const { client, from, query } = createRunUpdateClientMock({
      data: {
        id: RUN_ID,
      },
      error: null,
    });

    await markNoteChatRunRunning(RUN_ID, {
      supabase: client,
    });

    expect(from).toHaveBeenCalledWith("note_chat_runs");

    expect(query.update).toHaveBeenCalledWith({
      started_at: expect.any(String),
      status: AI_RUN_STATUS.RUNNING,
      updated_at: expect.any(String),
    });

    expect(query.eq).toHaveBeenNthCalledWith(1, "id", RUN_ID);
    expect(query.eq).toHaveBeenNthCalledWith(
      2,
      "status",
      AI_RUN_STATUS.PENDING,
    );
  });

  it("pending Run을 찾을 수 없으면 오류를 발생시킨다", async () => {
    const { client } = createRunUpdateClientMock({
      data: null,
      error: null,
    });

    await expect(
      markNoteChatRunRunning(RUN_ID, {
        supabase: client,
      }),
    ).rejects.toThrow(`Pending note chat run not found: ${RUN_ID}`);
  });

  it("Run 상태 변경 DB 오류를 전달한다", async () => {
    const { client } = createRunUpdateClientMock({
      data: null,
      error: {
        message: "Update failed",
      },
    });

    await expect(
      markNoteChatRunRunning(RUN_ID, {
        supabase: client,
      }),
    ).rejects.toThrow("Failed to mark note chat run as running: Update failed");
  });
});

describe("completeNoteChatRunSuccess", () => {
  it("Assistant Message와 Run 성공 결과를 RPC로 저장한다", async () => {
    const { client, rpc } = createRpcClientMock({
      data: ASSISTANT_MESSAGE_ID,
      error: null,
    });

    const result = await completeNoteChatRunSuccess(
      {
        content: "AI 답변입니다.",
        referencedNoteRanks: [],
        runId: RUN_ID,
        sources: [],
        usage: USAGE,
      },
      {
        supabase: client,
      },
    );

    expect(rpc).toHaveBeenCalledWith("complete_note_chat_run_success", {
      p_content: {
        referencedNoteRanks: [],
        text: "AI 답변입니다.",
      },
      p_run_id: RUN_ID,
      p_sources: [],
      p_usage: USAGE,
    });

    expect(result).toBe(ASSISTANT_MESSAGE_ID);
  });

  it("빈 Assistant Message를 저장하지 않는다", async () => {
    const { client, rpc } = createRpcClientMock({
      data: ASSISTANT_MESSAGE_ID,
      error: null,
    });

    await expect(
      completeNoteChatRunSuccess(
        {
          content: "   ",
          referencedNoteRanks: [],
          runId: RUN_ID,
          sources: [],
          usage: USAGE,
        },
        {
          supabase: client,
        },
      ),
    ).rejects.toThrow();

    expect(rpc).not.toHaveBeenCalled();
  });

  it("성공 완료 RPC 오류를 전달한다", async () => {
    const { client } = createRpcClientMock({
      data: null,
      error: {
        message: "Success completion failed",
      },
    });

    await expect(
      completeNoteChatRunSuccess(
        {
          content: "AI 답변입니다.",
          referencedNoteRanks: [],
          runId: RUN_ID,
          sources: [],
          usage: USAGE,
        },
        {
          supabase: client,
        },
      ),
    ).rejects.toThrow(
      "Failed to complete note chat run successfully: Success completion failed",
    );
  });

  it("Assistant Message ID가 반환되지 않으면 오류를 발생시킨다", async () => {
    const { client } = createRpcClientMock({
      data: null,
      error: null,
    });

    await expect(
      completeNoteChatRunSuccess(
        {
          content: "AI 답변입니다.",
          referencedNoteRanks: [],
          runId: RUN_ID,
          sources: [],
          usage: USAGE,
        },
        {
          supabase: client,
        },
      ),
    ).rejects.toThrow(
      `Note chat success completion returned no assistant message ID: ${RUN_ID}`,
    );
  });
});

describe("completeNoteChatRunFailure", () => {
  it("Run 실패 결과를 RPC로 저장한다", async () => {
    const { client, rpc } = createRpcClientMock({
      data: RUN_ID,
      error: null,
    });

    await completeNoteChatRunFailure(
      {
        runId: RUN_ID,
        usage: USAGE,
      },
      {
        supabase: client,
      },
    );

    expect(rpc).toHaveBeenCalledWith("complete_note_chat_run_failure", {
      p_run_id: RUN_ID,
      p_usage: USAGE,
    });
  });

  it("확인된 Usage가 없으면 null을 전달한다", async () => {
    const { client, rpc } = createRpcClientMock({
      data: RUN_ID,
      error: null,
    });

    await completeNoteChatRunFailure(
      {
        runId: RUN_ID,
        usage: null,
      },
      {
        supabase: client,
      },
    );

    expect(rpc).toHaveBeenCalledWith("complete_note_chat_run_failure", {
      p_run_id: RUN_ID,
      p_usage: null,
    });
  });

  it("실패 완료 RPC 오류를 전달한다", async () => {
    const { client } = createRpcClientMock({
      data: null,
      error: {
        message: "Failure completion failed",
      },
    });

    await expect(
      completeNoteChatRunFailure(
        {
          runId: RUN_ID,
          usage: null,
        },
        {
          supabase: client,
        },
      ),
    ).rejects.toThrow(
      "Failed to complete note chat run as failed: Failure completion failed",
    );
  });

  it("반환된 Run ID가 다르면 오류를 발생시킨다", async () => {
    const { client } = createRpcClientMock({
      data: "33333333-3333-4333-8333-333333333333",
      error: null,
    });

    await expect(
      completeNoteChatRunFailure(
        {
          runId: RUN_ID,
          usage: null,
        },
        {
          supabase: client,
        },
      ),
    ).rejects.toThrow(
      `Note chat failure completion returned an unexpected run ID: ${RUN_ID}`,
    );
  });
});
