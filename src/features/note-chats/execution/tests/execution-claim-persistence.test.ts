import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  claimNoteChatExecution,
  completeNoteChatExecutionClaim,
  completeNoteChatExecutionSuccess,
  NOTE_CHAT_EXECUTION_CLAIM_COMPLETION_STATUS,
  NOTE_CHAT_EXECUTION_CLAIM_STATUS,
} from "../execution-claim-persistence";

/** 테스트용 execution claim RPC mock 결과입니다. */
type RpcResult = {
  /** Supabase RPC 반환 데이터입니다. */
  data: unknown;

  /** Supabase RPC 오류입니다. */
  error: { message: string } | null;
};

/** 테스트용 Supabase Admin Client mock을 생성합니다. */
function createSupabaseMock(result: RpcResult) {
  return {
    rpc: vi.fn().mockResolvedValue(result),
  };
}

describe("note chat execution claim persistence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("conversation 실행을 claim하고 생성된 Claim ID를 반환한다", async () => {
    const claimId = "11111111-1111-4111-8111-111111111111";

    const supabase = createSupabaseMock({
      data: [
        {
          claim_id: claimId,
          status: NOTE_CHAT_EXECUTION_CLAIM_STATUS.CLAIMED,
        },
      ],
      error: null,
    });

    const result = await claimNoteChatExecution(
      {
        conversationId: "conversation-1",
        userId: "user-1",
      },
      {
        supabase,
      },
    );

    expect(result).toEqual({
      claimId,
      status: NOTE_CHAT_EXECUTION_CLAIM_STATUS.CLAIMED,
    });

    expect(supabase.rpc).toHaveBeenCalledWith("claim_note_chat_execution", {
      p_conversation_id: "conversation-1",
      p_daily_execution_limit: expect.any(Number),
      p_user_id: "user-1",
    });
  });

  it("동일 conversation에 active Claim이 있으면 duplicate 결과를 반환한다", async () => {
    const claimId = "11111111-1111-4111-8111-111111111111";

    const supabase = createSupabaseMock({
      data: [
        {
          claim_id: claimId,
          status: NOTE_CHAT_EXECUTION_CLAIM_STATUS.DUPLICATE,
        },
      ],
      error: null,
    });

    const result = await claimNoteChatExecution(
      {
        conversationId: "conversation-1",
        userId: "user-1",
      },
      {
        supabase,
      },
    );

    expect(result).toEqual({
      claimId,
      status: NOTE_CHAT_EXECUTION_CLAIM_STATUS.DUPLICATE,
    });
  });

  it("일일 실행 제한을 초과하면 Claim 없이 제한 상태를 반환한다", async () => {
    const supabase = createSupabaseMock({
      data: [
        {
          claim_id: null,
          status: NOTE_CHAT_EXECUTION_CLAIM_STATUS.DAILY_LIMIT_EXCEEDED,
        },
      ],
      error: null,
    });

    const result = await claimNoteChatExecution(
      {
        conversationId: "conversation-1",
        userId: "user-1",
      },
      {
        supabase,
      },
    );

    expect(result).toEqual({
      claimId: null,
      status: NOTE_CHAT_EXECUTION_CLAIM_STATUS.DAILY_LIMIT_EXCEEDED,
    });
  });

  it("claimed 결과에 Claim ID가 없으면 오류를 발생시킨다", async () => {
    const supabase = createSupabaseMock({
      data: [
        {
          claim_id: null,
          status: NOTE_CHAT_EXECUTION_CLAIM_STATUS.CLAIMED,
        },
      ],
      error: null,
    });

    await expect(
      claimNoteChatExecution(
        {
          conversationId: "conversation-1",
          userId: "user-1",
        },
        {
          supabase,
        },
      ),
    ).rejects.toThrow("Note chat execution claim returned no claim ID.");
  });

  it("claim RPC가 row를 반환하지 않으면 오류를 발생시킨다", async () => {
    const supabase = createSupabaseMock({
      data: [],
      error: null,
    });

    await expect(
      claimNoteChatExecution(
        {
          conversationId: "conversation-1",
          userId: "user-1",
        },
        {
          supabase,
        },
      ),
    ).rejects.toThrow("Note chat execution claim returned no row.");
  });

  it("claim RPC 오류를 호출부에 전달한다", async () => {
    const supabase = createSupabaseMock({
      data: null,
      error: {
        message: "claim failed",
      },
    });

    await expect(
      claimNoteChatExecution(
        {
          conversationId: "conversation-1",
          userId: "user-1",
        },
        {
          supabase,
        },
      ),
    ).rejects.toThrow("Failed to claim note chat execution: claim failed");
  });

  it("실패한 Claim을 failed 상태로 종료한다", async () => {
    const claimId = "11111111-1111-4111-8111-111111111111";

    const supabase = createSupabaseMock({
      data: claimId,
      error: null,
    });

    await completeNoteChatExecutionClaim(
      {
        claimId,
        status: NOTE_CHAT_EXECUTION_CLAIM_COMPLETION_STATUS.FAILED,
      },
      {
        supabase,
      },
    );

    expect(supabase.rpc).toHaveBeenCalledWith(
      "complete_note_chat_execution_claim",
      {
        p_claim_id: claimId,
        p_status: NOTE_CHAT_EXECUTION_CLAIM_COMPLETION_STATUS.FAILED,
      },
    );
  });

  it("만료된 Claim을 stale 상태로 종료한다", async () => {
    const claimId = "11111111-1111-4111-8111-111111111111";

    const supabase = createSupabaseMock({
      data: claimId,
      error: null,
    });

    await completeNoteChatExecutionClaim(
      {
        claimId,
        status: NOTE_CHAT_EXECUTION_CLAIM_COMPLETION_STATUS.STALE,
      },
      {
        supabase,
      },
    );

    expect(supabase.rpc).toHaveBeenCalledWith(
      "complete_note_chat_execution_claim",
      {
        p_claim_id: claimId,
        p_status: NOTE_CHAT_EXECUTION_CLAIM_COMPLETION_STATUS.STALE,
      },
    );
  });

  it("일반 Claim 완료 상태에는 succeeded를 노출하지 않는다", () => {
    expect(NOTE_CHAT_EXECUTION_CLAIM_COMPLETION_STATUS).toEqual({
      FAILED: "failed",
      STALE: "stale",
    });
  });

  it("Claim 완료 RPC가 요청한 Claim ID를 반환하지 않으면 오류를 발생시킨다", async () => {
    const claimId = "11111111-1111-4111-8111-111111111111";

    const supabase = createSupabaseMock({
      data: "22222222-2222-4222-8222-222222222222",
      error: null,
    });

    await expect(
      completeNoteChatExecutionClaim(
        {
          claimId,
          status: NOTE_CHAT_EXECUTION_CLAIM_COMPLETION_STATUS.FAILED,
        },
        {
          supabase,
        },
      ),
    ).rejects.toThrow(
      `Note chat execution claim completion returned an unexpected claim ID: ${claimId}`,
    );
  });

  it("Claim 완료 RPC 오류를 호출부에 전달한다", async () => {
    const claimId = "11111111-1111-4111-8111-111111111111";

    const supabase = createSupabaseMock({
      data: null,
      error: {
        message: "completion failed",
      },
    });

    await expect(
      completeNoteChatExecutionClaim(
        {
          claimId,
          status: NOTE_CHAT_EXECUTION_CLAIM_COMPLETION_STATUS.FAILED,
        },
        {
          supabase,
        },
      ),
    ).rejects.toThrow(
      "Failed to complete note chat execution claim: completion failed",
    );
  });

  it("Assistant Message 저장과 Claim 성공 확정을 하나의 성공 RPC로 요청한다", async () => {
    const claimId = "11111111-1111-4111-8111-111111111111";
    const userMessageId = "22222222-2222-4222-8222-222222222222";
    const assistantMessageId = "33333333-3333-4333-8333-333333333333";
    const usedNoteId = "44444444-4444-4444-8444-444444444444";

    const supabase = createSupabaseMock({
      data: assistantMessageId,
      error: null,
    });

    const result = await completeNoteChatExecutionSuccess(
      {
        claimId,
        content: "AI 답변입니다.",
        usedNoteIds: [usedNoteId],
        userId: "user-1",
        userMessageId,
      },
      {
        supabase,
      },
    );

    expect(result).toBe(assistantMessageId);

    expect(supabase.rpc).toHaveBeenCalledWith(
      "complete_note_chat_execution_success",
      {
        p_claim_id: claimId,
        p_content: {
          text: "AI 답변입니다.",
          usedNoteIds: [usedNoteId],
        },
        p_user_id: "user-1",
        p_user_message_id: userMessageId,
      },
    );
  });

  it("사용된 Note가 없어도 성공 RPC에 빈 usedNoteIds를 전달한다", async () => {
    const claimId = "11111111-1111-4111-8111-111111111111";
    const userMessageId = "22222222-2222-4222-8222-222222222222";
    const assistantMessageId = "33333333-3333-4333-8333-333333333333";

    const supabase = createSupabaseMock({
      data: assistantMessageId,
      error: null,
    });

    await completeNoteChatExecutionSuccess(
      {
        claimId,
        content: "관련된 노트를 찾지 못했습니다.",
        usedNoteIds: [],
        userId: "user-1",
        userMessageId,
      },
      {
        supabase,
      },
    );

    expect(supabase.rpc).toHaveBeenCalledWith(
      "complete_note_chat_execution_success",
      {
        p_claim_id: claimId,
        p_content: {
          text: "관련된 노트를 찾지 못했습니다.",
          usedNoteIds: [],
        },
        p_user_id: "user-1",
        p_user_message_id: userMessageId,
      },
    );
  });

  it("성공 확정 RPC 오류를 실제 실행 오류로 전달한다", async () => {
    const supabase = createSupabaseMock({
      data: null,
      error: {
        message: "atomic success failed",
      },
    });

    await expect(
      completeNoteChatExecutionSuccess(
        {
          claimId: "11111111-1111-4111-8111-111111111111",
          content: "AI 답변입니다.",
          usedNoteIds: [],
          userId: "user-1",
          userMessageId: "22222222-2222-4222-8222-222222222222",
        },
        {
          supabase,
        },
      ),
    ).rejects.toThrow(
      "Failed to complete note chat execution success: atomic success failed",
    );
  });

  it("성공 확정 RPC가 Assistant Message ID를 반환하지 않으면 오류를 발생시킨다", async () => {
    const userMessageId = "22222222-2222-4222-8222-222222222222";

    const supabase = createSupabaseMock({
      data: null,
      error: null,
    });

    await expect(
      completeNoteChatExecutionSuccess(
        {
          claimId: "11111111-1111-4111-8111-111111111111",
          content: "AI 답변입니다.",
          usedNoteIds: [],
          userId: "user-1",
          userMessageId,
        },
        {
          supabase,
        },
      ),
    ).rejects.toThrow(
      `Note chat execution success returned no assistant message ID: ${userMessageId}`,
    );
  });
});
