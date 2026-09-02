import { z } from "zod";

import { createAdminClient } from "@/lib/supabase/admin";

import { NOTE_CHAT_DAILY_EXECUTION_LIMIT } from "../constants/execution";
import { noteChatAssistantMessageContentSchema } from "../schema";

/** Note Chat 실행 claim 요청 결과 상태입니다. */
export const NOTE_CHAT_EXECUTION_CLAIM_STATUS = {
  CLAIMED: "claimed",
  DAILY_LIMIT_EXCEEDED: "daily_limit_exceeded",
  DUPLICATE: "duplicate",
} as const;

/** Note Chat 실행 claim 요청 결과 상태 타입입니다. */
export type NoteChatExecutionClaimStatus =
  (typeof NOTE_CHAT_EXECUTION_CLAIM_STATUS)[keyof typeof NOTE_CHAT_EXECUTION_CLAIM_STATUS];

/** Note Chat 실행 claim RPC 반환 상태 검증 schema입니다. */
const noteChatExecutionClaimStatusSchema = z.enum([
  NOTE_CHAT_EXECUTION_CLAIM_STATUS.CLAIMED,
  NOTE_CHAT_EXECUTION_CLAIM_STATUS.DAILY_LIMIT_EXCEEDED,
  NOTE_CHAT_EXECUTION_CLAIM_STATUS.DUPLICATE,
]);

/** Note Chat 실행 claim RPC 반환 row 검증 schema입니다. */
const noteChatExecutionClaimRowSchema = z.object({
  claim_id: z.string().uuid().nullable(),
  status: noteChatExecutionClaimStatusSchema,
});

/**
 * Note Chat 실행 실패/정리 claim 완료 상태입니다.
 *
 * 성공 상태는 의도적으로 포함하지 않습니다.
 * 성공 실행은 Assistant Message 저장과 Claim succeeded 전환을
 * 하나의 transaction으로 처리해야 하므로
 * completeNoteChatExecutionSuccess()에서 별도로 처리합니다.
 */
export const NOTE_CHAT_EXECUTION_CLAIM_COMPLETION_STATUS = {
  FAILED: "failed",
  STALE: "stale",
} as const;

/** Note Chat 실행 실패/정리 claim 완료 상태 타입입니다. */
export type NoteChatExecutionClaimCompletionStatus =
  (typeof NOTE_CHAT_EXECUTION_CLAIM_COMPLETION_STATUS)[keyof typeof NOTE_CHAT_EXECUTION_CLAIM_COMPLETION_STATUS];

/** Note Chat 실행 claim 생성 입력입니다. */
export type ClaimNoteChatExecutionParams = {
  /** 실행을 선점할 Conversation ID입니다. */
  conversationId: string;

  /** 실행을 요청한 사용자 ID입니다. */
  userId: string;
};

/** Note Chat 실행 claim 결과입니다. */
export type ClaimNoteChatExecutionResult =
  | {
      /** 새 실행 claim을 생성했습니다. */
      claimId: string;
      status: typeof NOTE_CHAT_EXECUTION_CLAIM_STATUS.CLAIMED;
    }
  | {
      /** 실행이 생성되지 않았거나 기존 active claim으로 대체되었습니다. */
      claimId: string | null;
      status: Exclude<
        NoteChatExecutionClaimStatus,
        typeof NOTE_CHAT_EXECUTION_CLAIM_STATUS.CLAIMED
      >;
    };

/** Note Chat 실패/정리 claim 완료 입력입니다. */
export type CompleteNoteChatExecutionClaimParams = {
  /** 완료할 실행 claim ID입니다. */
  claimId: string;

  /** failed 또는 stale 완료 상태입니다. */
  status: NoteChatExecutionClaimCompletionStatus;
};

/** Note Chat 실행 성공 확정 입력입니다. */
export type CompleteNoteChatExecutionSuccessParams = {
  /** 성공으로 완료할 실행 claim ID입니다. */
  claimId: string;

  /** 생성된 Assistant 답변 본문입니다. */
  content: string;

  /** 실행을 요청한 사용자 ID입니다. */
  userId: string;

  /** Assistant Message가 연결될 User Message ID입니다. */
  userMessageId: string;

  /** 답변 생성에 실제 사용된 Note ID 목록입니다. */
  usedNoteIds: string[];
};

/** Note Chat 실행 claim 저장에 필요한 Supabase Admin Client 최소 형태입니다. */
type NoteChatExecutionClaimClient = Pick<
  ReturnType<typeof createAdminClient>,
  "rpc"
>;

/**
 * Note Chat 실행을 conversation 단위로 claim합니다.
 *
 * 이 함수는 run 기록 테이블에 의존하지 않고 conversation in-flight와
 * 일일 실행 제한을 판정합니다. `claimed`일 때만 사용자 메시지 변경과
 * Provider 실행을 시작해야 합니다.
 *
 * @param params claim할 conversation과 사용자 정보
 * @param options 테스트에서 주입할 Supabase Client
 * @returns Note Chat 실행 claim 결과
 */
export async function claimNoteChatExecution(
  params: ClaimNoteChatExecutionParams,
  options: {
    supabase?: NoteChatExecutionClaimClient | undefined;
  } = {},
): Promise<ClaimNoteChatExecutionResult> {
  const supabase = options.supabase ?? createAdminClient();

  const { data, error } = await supabase.rpc("claim_note_chat_execution", {
    p_conversation_id: params.conversationId,
    p_daily_execution_limit: NOTE_CHAT_DAILY_EXECUTION_LIMIT,
    p_user_id: params.userId,
  });

  if (error) {
    throw new Error(`Failed to claim note chat execution: ${error.message}`);
  }

  const resultRow = data[0];

  if (!resultRow) {
    throw new Error("Note chat execution claim returned no row.");
  }

  const result = noteChatExecutionClaimRowSchema.parse(resultRow);

  if (result.status === NOTE_CHAT_EXECUTION_CLAIM_STATUS.CLAIMED) {
    const claimedClaimId = result.claim_id;

    if (claimedClaimId === null) {
      throw new Error("Note chat execution claim returned no claim ID.");
    }

    return {
      claimId: claimedClaimId,
      status: result.status,
    };
  }

  return {
    claimId: result.claim_id,
    status: result.status,
  };
}

/**
 * 실패하거나 만료된 Note Chat execution claim을 종료합니다.
 *
 * 이 함수는 failed/stale 정리 전용입니다.
 * 성공 상태는 여기서 처리하지 않습니다.
 *
 * 성공 실행은 Assistant Message 저장과 Claim succeeded 전환이
 * 하나의 transaction으로 완료되어야 하므로
 * completeNoteChatExecutionSuccess()를 사용합니다.
 *
 * 실패 cleanup 자체가 실패하더라도 원래 실행 오류를 덮어쓰지 않도록
 * 호출부에서는 best-effort로 사용하는 것을 전제로 합니다.
 *
 * @param params 완료할 claim ID와 failed/stale 상태
 * @param options 테스트에서 주입할 Supabase Client
 */
export async function completeNoteChatExecutionClaim(
  params: CompleteNoteChatExecutionClaimParams,
  options: {
    supabase?: NoteChatExecutionClaimClient | undefined;
  } = {},
): Promise<void> {
  const supabase = options.supabase ?? createAdminClient();

  const { data, error } = await supabase.rpc(
    "complete_note_chat_execution_claim",
    {
      p_claim_id: params.claimId,
      p_status: params.status,
    },
  );

  if (error) {
    throw new Error(
      `Failed to complete note chat execution claim: ${error.message}`,
    );
  }

  if (data !== params.claimId) {
    throw new Error(
      `Note chat execution claim completion returned an unexpected claim ID: ${params.claimId}`,
    );
  }
}

/**
 * Note Chat 실행 성공을 확정합니다.
 *
 * Assistant Message 저장과 Claim의 running -> succeeded 전환을
 * DB의 하나의 transaction에서 처리합니다.
 *
 * 둘 중 하나라도 실패하면 transaction 전체가 rollback되므로,
 * Assistant Message만 저장되고 Claim이 running으로 남거나
 * Claim만 succeeded가 되는 상태를 방지합니다.
 *
 * Run 감사 기록은 이 성공 transaction에 포함하지 않으며
 * 호출부에서 별도 best-effort로 갱신합니다.
 *
 * @param params 성공 확정에 필요한 Claim과 Assistant Message 정보
 * @param options 테스트에서 주입할 Supabase Client
 * @returns 생성된 Assistant Message ID
 */
export async function completeNoteChatExecutionSuccess(
  params: CompleteNoteChatExecutionSuccessParams,
  options: {
    supabase?: NoteChatExecutionClaimClient | undefined;
  } = {},
): Promise<string> {
  const supabase = options.supabase ?? createAdminClient();

  const content = noteChatAssistantMessageContentSchema.parse({
    text: params.content,
    usedNoteIds: params.usedNoteIds,
  });

  const { data: assistantMessageId, error } = await supabase.rpc(
    "complete_note_chat_execution_success",
    {
      p_claim_id: params.claimId,
      p_content: content,
      p_user_id: params.userId,
      p_user_message_id: params.userMessageId,
    },
  );

  if (error) {
    throw new Error(
      `Failed to complete note chat execution success: ${error.message}`,
    );
  }

  if (!assistantMessageId) {
    throw new Error(
      `Note chat execution success returned no assistant message ID: ${params.userMessageId}`,
    );
  }

  return assistantMessageId;
}
