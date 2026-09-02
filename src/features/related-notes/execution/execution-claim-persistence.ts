import { z } from "zod";

import { createAdminClient } from "@/lib/supabase/admin";

import { RELATED_NOTES_DAILY_RECOMMENDATION_LIMIT_PER_NOTE } from "../constants/ai";

/** Related Notes 추천 실행 claim 상태입니다. */
export const RELATED_NOTE_RECOMMENDATION_EXECUTION_CLAIM_STATUS = {
  CLAIMED: "claimed",
  DAILY_LIMIT_EXCEEDED: "daily_limit_exceeded",
  DUPLICATE: "duplicate",
  STALE: "stale",
} as const;

/** Related Notes 추천 실행 claim 상태 타입입니다. */
export type RelatedNoteRecommendationExecutionClaimStatus =
  (typeof RELATED_NOTE_RECOMMENDATION_EXECUTION_CLAIM_STATUS)[keyof typeof RELATED_NOTE_RECOMMENDATION_EXECUTION_CLAIM_STATUS];

/** Related Notes 추천 실행 claim RPC 반환 상태 검증 schema입니다. */
const relatedNoteRecommendationExecutionClaimStatusSchema = z.enum([
  RELATED_NOTE_RECOMMENDATION_EXECUTION_CLAIM_STATUS.CLAIMED,
  RELATED_NOTE_RECOMMENDATION_EXECUTION_CLAIM_STATUS.DAILY_LIMIT_EXCEEDED,
  RELATED_NOTE_RECOMMENDATION_EXECUTION_CLAIM_STATUS.DUPLICATE,
  RELATED_NOTE_RECOMMENDATION_EXECUTION_CLAIM_STATUS.STALE,
]);

/** Related Notes 추천 실행 claim RPC 반환 row 검증 schema입니다. */
const relatedNoteRecommendationExecutionClaimRowSchema = z.object({
  claim_id: z.string().uuid().nullable(),
  status: relatedNoteRecommendationExecutionClaimStatusSchema,
});

/** Related Notes 추천 실행 claim 완료 상태입니다. */
export const RELATED_NOTE_RECOMMENDATION_EXECUTION_CLAIM_COMPLETION_STATUS = {
  FAILED: "failed",
  STALE: "stale",
  SUCCEEDED: "succeeded",
} as const;

/** Related Notes 추천 실행 claim 완료 상태 타입입니다. */
export type RelatedNoteRecommendationExecutionClaimCompletionStatus =
  (typeof RELATED_NOTE_RECOMMENDATION_EXECUTION_CLAIM_COMPLETION_STATUS)[keyof typeof RELATED_NOTE_RECOMMENDATION_EXECUTION_CLAIM_COMPLETION_STATUS];

/** Related Notes 추천 실행 claim 생성 입력입니다. */
export type ClaimRelatedNoteRecommendationExecutionParams = {
  /** 추천 대상 Note ID입니다. */
  noteId: string;

  /** 추천 대상 Note의 source snapshot updated_at입니다. */
  sourceUpdatedAt: string;

  /** 추천 대상 Note의 소유 사용자 ID입니다. */
  userId: string;
};

/** Related Notes 추천 실행 claim 결과입니다. */
export type ClaimRelatedNoteRecommendationExecutionResult =
  | {
      /** 새 실행 claim을 생성했습니다. */
      claimId: string;
      status: typeof RELATED_NOTE_RECOMMENDATION_EXECUTION_CLAIM_STATUS.CLAIMED;
    }
  | {
      /** 실행이 생성되지 않았거나 기존 active claim으로 대체되었습니다. */
      claimId: string | null;
      status: Exclude<
        RelatedNoteRecommendationExecutionClaimStatus,
        typeof RELATED_NOTE_RECOMMENDATION_EXECUTION_CLAIM_STATUS.CLAIMED
      >;
    };

/** Related Notes 추천 실행 claim 완료 입력입니다. */
export type CompleteRelatedNoteRecommendationExecutionClaimParams = {
  /** 완료할 실행 claim ID입니다. */
  claimId: string;

  /** claim 완료 상태입니다. */
  status: RelatedNoteRecommendationExecutionClaimCompletionStatus;

  /** 완료할 실행 claim의 소유 사용자 ID입니다. */
  userId: string;
};

/** Related Notes 추천 실행 claim 저장에 필요한 Supabase Admin Client 최소 형태입니다. */
type RelatedNoteRecommendationExecutionClaimClient = Pick<
  ReturnType<typeof createAdminClient>,
  "rpc"
>;

/**
 * Related Notes 추천 실행을 claim합니다.
 *
 * 이 함수는 run 기록 테이블에 의존하지 않고 source stale, duplicate,
 * 일일 제한을 판정합니다. `claimed`일 때만 Provider 실행을 시작해야 합니다.
 *
 * @param params 추천 실행 claim 입력
 * @param options 테스트에서 주입할 Supabase Client
 * @returns 추천 실행 claim 결과
 */
export async function claimRelatedNoteRecommendationExecution(
  params: ClaimRelatedNoteRecommendationExecutionParams,
  options: {
    supabase?: RelatedNoteRecommendationExecutionClaimClient | undefined;
  } = {},
): Promise<ClaimRelatedNoteRecommendationExecutionResult> {
  const supabase = options.supabase ?? createAdminClient();

  const { data, error } = await supabase.rpc(
    "claim_related_note_recommendation_execution",
    {
      p_daily_recommendation_limit:
        RELATED_NOTES_DAILY_RECOMMENDATION_LIMIT_PER_NOTE,
      p_note_id: params.noteId,
      p_source_updated_at: params.sourceUpdatedAt,
      p_user_id: params.userId,
    },
  );

  if (error) {
    throw new Error(
      `Failed to claim related note recommendation execution: ${error.message}`,
    );
  }

  const resultRow = data[0];

  if (!resultRow) {
    throw new Error(
      "Related note recommendation execution claim returned no row.",
    );
  }

  const result =
    relatedNoteRecommendationExecutionClaimRowSchema.parse(resultRow);

  if (
    result.status === RELATED_NOTE_RECOMMENDATION_EXECUTION_CLAIM_STATUS.CLAIMED
  ) {
    const claimedClaimId = result.claim_id;

    if (claimedClaimId === null) {
      throw new Error(
        "Related note recommendation execution claim returned no claim ID.",
      );
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
 * Related Notes 추천 실행 claim을 완료 상태로 전환합니다.
 *
 * claim 완료는 기능 제어용 active claim 해제 책임을 가지므로,
 * run 기록 완료와 별개로 반드시 시도해야 합니다.
 *
 * DB RPC에도 사용자 ID를 전달하여 service role 호출에서도
 * 다른 사용자의 Claim을 완료할 수 없도록 소유권을 함께 검증합니다.
 *
 * @param params 완료할 claim ID, 소유 사용자 ID와 상태
 * @param options 테스트에서 주입할 Supabase Client
 */
export async function completeRelatedNoteRecommendationExecutionClaim(
  params: CompleteRelatedNoteRecommendationExecutionClaimParams,
  options: {
    supabase?: RelatedNoteRecommendationExecutionClaimClient | undefined;
  } = {},
): Promise<void> {
  const supabase = options.supabase ?? createAdminClient();

  const { data, error } = await supabase.rpc(
    "complete_related_note_recommendation_execution_claim",
    {
      p_claim_id: params.claimId,
      p_status: params.status,
      p_user_id: params.userId,
    },
  );

  if (error) {
    throw new Error(
      `Failed to complete related note recommendation execution claim: ${error.message}`,
    );
  }

  if (data !== params.claimId) {
    throw new Error(
      `Related note recommendation execution claim completion returned an unexpected claim ID: ${params.claimId}`,
    );
  }
}
