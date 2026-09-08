"use server";

import { z } from "zod";

import { requireCurrentLegalAcceptance } from "@/features/auth/utils/requireCurrentLegalAcceptance";
import {
  RELATED_NOTES_OPERATIONAL_ERROR_CODES,
  RELATED_NOTES_OPERATIONAL_ERROR_OPERATIONS,
} from "@/features/operational-errors/constants";
import { getNoteDetailRoute } from "@/lib/constants/routes";
import { logError } from "@/lib/logger";
import { createServerComponentClient } from "@/lib/supabase/server";
import { escapePostgrestLikePattern } from "@/lib/utils/escapePostgrestLikePattern";

import {
  RELATED_NOTES_DAILY_RECOMMENDATION_LIMIT,
  RELATED_NOTES_DAILY_RECOMMENDATION_LIMIT_PER_NOTE,
} from "./constants/ai";
import { relatedNoteRowSchema } from "./schemas";
import type { RelatedNoteRecommendation } from "./types";
import { isMissingRpcFunctionError } from "./utils/is-missing-rpc-function-error";
import { reportRelatedNotesOperationalError } from "./utils/report-operational-error";
import { resolveOtherRelatedNoteId } from "./utils/resolve-other-related-note-id";

type RelatedNoteRecommendationExecutionStatus =
  | "running"
  | "succeeded"
  | "failed"
  | "stale";

type RelatedNoteRecommendationExecution = {
  /** execution Claim ID입니다. */
  id: string;

  /** 현재 Claim 상태입니다. */
  status: RelatedNoteRecommendationExecutionStatus;
};

export type RelatedNoteRecommendationExecutionClaim =
  RelatedNoteRecommendationExecution;

/** Related Notes 섹션 조회 결과입니다. */
export type RelatedNotesQueryResult = {
  /** 현재 표시할 Related Notes 목록입니다. */
  relatedNotes: RelatedNoteRecommendation[];

  /** 현재 Note에 대해 AI 추천 실행이 진행 중인지 여부입니다. */
  hasRunningRecommendationExecution: boolean;

  /** 현재 Note의 가장 최근 AI 추천 실행이 실패했는지 여부입니다. */
  hasFailedRecommendationExecution: boolean;

  /**
   * 현재 Note version의 가장 최근 AI 추천 execution Claim입니다.
   *
   * Client는 수동 요청에서 받은 Claim ID와 비교하여
   * running 상태를 직접 관찰하지 못한 경우에도 완료 여부를 판정합니다.
   */
  latestRecommendationExecution: RelatedNoteRecommendationExecution | null;

  /**
   * 현재 Note의 요청 가능 여부와 사용자의 오늘 전체 AI 추천 사용량입니다.
   *
   * 일일 실행 제한을 적용받는 일반 사용자에게만 반환하며,
   * quota를 우회하는 ADMIN에게는 null을 반환합니다.
   */
  recommendationQuota: {
    canRequestForNote: boolean;
    isNoteLimitReached: boolean;
    isUserLimitReached: boolean;
    noteLimit: number;
    userLimit: number;
    userUsed: number;
  } | null;
};

/** Related Notes AI 추천 실행의 UI 상태입니다. */
type RelatedNoteRecommendationExecutionUiState = {
  /** 가장 최근 AI 추천 실행이 진행 중인지 여부입니다. */
  hasRunningRecommendationExecution: boolean;

  /** 가장 최근 AI 추천 실행이 실패했는지 여부입니다. */
  hasFailedRecommendationExecution: boolean;

  /** 현재 Note version의 가장 최근 execution Claim입니다. */
  latestRecommendationExecution: RelatedNoteRecommendationExecution | null;
};

/**
 * 지정한 Note에 현재 연결되어 있는 Related Notes를 조회합니다.
 *
 * 사용자가 직접 연결한 관계와 AI 추천 관계 중 active 상태인 관계만 반환하며,
 * 각 관계의 origin도 함께 반환합니다.
 *
 * dismissed AI 추천은 화면에 표시하지 않습니다.
 *
 * 일반 사용자는 현재 Note의 KST 기준 일일 AI 추천 사용량도 함께 조회합니다.
 * ADMIN은 일일 실행 제한을 적용받지 않으므로 사용량 RPC를 호출하지 않습니다.
 *
 * @param noteId Related Notes를 조회할 기준 Note ID
 * @returns 현재 표시할 Related Notes 목록, AI 추천 실행 상태와 일일 사용량
 */
export async function getRelatedNotes(
  noteId: string,
): Promise<RelatedNotesQueryResult> {
  const parsedNoteId = z.string().uuid().safeParse(noteId);

  if (!parsedNoteId.success) {
    return {
      hasFailedRecommendationExecution: false,
      hasRunningRecommendationExecution: false,
      latestRecommendationExecution: null,
      recommendationQuota: null,
      relatedNotes: [],
    };
  }

  const supabase = await createServerComponentClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      hasFailedRecommendationExecution: false,
      hasRunningRecommendationExecution: false,
      latestRecommendationExecution: null,
      recommendationQuota: null,
      relatedNotes: [],
    };
  }

  await requireCurrentLegalAcceptance(
    user.id,
    getNoteDetailRoute(parsedNoteId.data),
  );

  const [sourceNoteResult, profileResult] = await Promise.all([
    supabase
      .from("notes")
      .select("updated_at")
      .eq("id", parsedNoteId.data)
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase.from("profiles").select("role").eq("id", user.id).maybeSingle(),
  ]);

  const { data: sourceNote, error: sourceNoteError } = sourceNoteResult;

  if (sourceNoteError) {
    await reportRelatedNotesOperationalError({
      actorUserId: user.id,
      error: sourceNoteError,
      errorCode: RELATED_NOTES_OPERATIONAL_ERROR_CODES.SOURCE_NOTE_LOAD_FAILED,
      message: "Related Notes 조회를 위한 기준 Note 조회에 실패했습니다.",
      operation: RELATED_NOTES_OPERATIONAL_ERROR_OPERATIONS.LOAD_SOURCE_NOTE,
      context: {
        noteId: parsedNoteId.data,
      },
      userId: user.id,
    });

    return {
      hasFailedRecommendationExecution: false,
      hasRunningRecommendationExecution: false,
      latestRecommendationExecution: null,
      recommendationQuota: null,
      relatedNotes: [],
    };
  }

  if (!sourceNote) {
    return {
      hasFailedRecommendationExecution: false,
      hasRunningRecommendationExecution: false,
      latestRecommendationExecution: null,
      recommendationQuota: null,
      relatedNotes: [],
    };
  }

  const { data: profile, error: profileError } = profileResult;

  if (profileError) {
    await reportRelatedNotesOperationalError({
      actorUserId: user.id,
      error: profileError,
      errorCode: RELATED_NOTES_OPERATIONAL_ERROR_CODES.DAILY_USAGE_LOAD_FAILED,
      message:
        "Related Notes 일일 사용량 조회를 위한 사용자 역할 조회에 실패했습니다.",
      operation: RELATED_NOTES_OPERATIONAL_ERROR_OPERATIONS.GET_DAILY_USAGE,
      userId: user.id,
    });
  }

  const shouldQueryRecommendationQuota =
    !profileError && profile?.role === "USER";

  let recommendationQuota: RelatedNotesQueryResult["recommendationQuota"] =
    null;

  if (shouldQueryRecommendationQuota) {
    /*
     * 일반 사용자는 quota RPC가 사용자 전체 stale Claim 정리까지 수행합니다.
     * 실행 상태를 읽기 전에 완료하여 stale 상태와 UI 상태가 엇갈리지 않게 합니다.
     */
    const v2RecommendationQuotaResult = await supabase.rpc(
      "get_related_note_recommendation_daily_usage_v2",
      {
        p_note_daily_recommendation_limit:
          RELATED_NOTES_DAILY_RECOMMENDATION_LIMIT_PER_NOTE,
        p_note_id: parsedNoteId.data,
        p_user_daily_recommendation_limit:
          RELATED_NOTES_DAILY_RECOMMENDATION_LIMIT,
      },
    );

    /*
     * 신 앱/구 DB 전환 구간에는 v2가 아직 없을 수 있습니다.
     * 이때만 기존 두 필드 계약을 사용하고 현재 TypeScript 정책값으로 결과를 보완합니다.
     */
    const legacyRecommendationQuotaResult = isMissingRpcFunctionError(
      v2RecommendationQuotaResult.error,
    )
      ? await supabase.rpc("get_related_note_recommendation_daily_usage", {
          p_note_id: parsedNoteId.data,
        })
      : null;

    const recommendationQuotaError =
      legacyRecommendationQuotaResult === null
        ? v2RecommendationQuotaResult.error
        : legacyRecommendationQuotaResult.error;

    if (recommendationQuotaError) {
      await reportRelatedNotesOperationalError({
        actorUserId: user.id,
        error: recommendationQuotaError,
        errorCode:
          RELATED_NOTES_OPERATIONAL_ERROR_CODES.DAILY_USAGE_LOAD_FAILED,
        message: "Related Notes 일일 AI 추천 사용량 조회에 실패했습니다.",
        operation: RELATED_NOTES_OPERATIONAL_ERROR_OPERATIONS.GET_DAILY_USAGE,
        userId: user.id,
      });
    } else if (legacyRecommendationQuotaResult) {
      // legacy 결과에는 사용자/Note별 한도 도달 여부가 없어 기존 계약으로 복원합니다.
      const parsedLegacyRecommendationQuota = z
        .tuple([
          z.object({
            can_request_for_note: z.boolean(),
            user_used: z.number().int().nonnegative(),
          }),
        ])
        .safeParse(legacyRecommendationQuotaResult.data);

      if (!parsedLegacyRecommendationQuota.success) {
        logError({
          message: "[getRelatedNotes] legacy AI 추천 일일 사용량 파싱 실패",
          error: parsedLegacyRecommendationQuota.error,
        });
      } else {
        const legacyQuota = parsedLegacyRecommendationQuota.data[0];
        const isUserLimitReached =
          legacyQuota.user_used >= RELATED_NOTES_DAILY_RECOMMENDATION_LIMIT;

        recommendationQuota = {
          canRequestForNote: legacyQuota.can_request_for_note,
          isNoteLimitReached:
            !legacyQuota.can_request_for_note && !isUserLimitReached,
          isUserLimitReached,
          noteLimit: RELATED_NOTES_DAILY_RECOMMENDATION_LIMIT_PER_NOTE,
          userLimit: RELATED_NOTES_DAILY_RECOMMENDATION_LIMIT,
          userUsed: legacyQuota.user_used,
        };
      }
    } else {
      // DB가 반환한 quota 판정과 표시용 한도를 런타임에서 검증합니다.
      const parsedRecommendationQuota = z
        .tuple([
          z.object({
            can_request_for_note: z.boolean(),
            is_note_limit_reached: z.boolean(),
            is_user_limit_reached: z.boolean(),
            note_limit: z.number().int().positive(),
            user_limit: z.number().int().positive(),
            user_used: z.number().int().nonnegative(),
          }),
        ])
        .safeParse(v2RecommendationQuotaResult.data);

      if (!parsedRecommendationQuota.success) {
        logError({
          message: "[getRelatedNotes] AI 추천 일일 사용량 파싱 실패",
          error: parsedRecommendationQuota.error,
        });
      } else {
        const quota = parsedRecommendationQuota.data[0];

        recommendationQuota = {
          canRequestForNote: quota.can_request_for_note,
          isNoteLimitReached: quota.is_note_limit_reached,
          isUserLimitReached: quota.is_user_limit_reached,
          noteLimit: quota.note_limit,
          userLimit: quota.user_limit,
          userUsed: quota.user_used,
        };
      }
    }
  } else {
    /*
     * ADMIN과 role 조회 실패 경로는 quota RPC를 호출하지 않으므로,
     * 기존 Note 단위 cleanup을 실행 상태 조회 전에 별도로 수행합니다.
     */
    const { error: staleCleanupError } = await supabase.rpc(
      "cleanup_related_note_recommendation_stale_execution_claims",
      {
        p_note_id: parsedNoteId.data,
      },
    );

    if (staleCleanupError) {
      await reportRelatedNotesOperationalError({
        actorUserId: user.id,
        error: staleCleanupError,
        errorCode:
          RELATED_NOTES_OPERATIONAL_ERROR_CODES.RECOMMENDATION_EXECUTION_STATE_LOAD_FAILED,
        message: "Related Notes AI 추천 만료 실행 상태 정리에 실패했습니다.",
        operation:
          RELATED_NOTES_OPERATIONAL_ERROR_OPERATIONS.LOAD_RECOMMENDATION_EXECUTION_STATE,
        context: {
          noteId: parsedNoteId.data,
        },
        userId: user.id,
      });
    }
  }

  const relatedNotesQuery = supabase
    .from("note_related_notes")
    .select(
      "id, note_id, related_note_id, origin, metadata, source_note:notes!note_related_notes_note_id_fkey(title), related_note:notes!note_related_notes_related_note_id_fkey(title)",
    )
    .eq("status", "active")
    .or(
      `note_id.eq.${parsedNoteId.data},related_note_id.eq.${parsedNoteId.data}`,
    )
    .order("created_at", { ascending: true });

  /*
   * boolean 상태뿐 아니라 Claim ID까지 함께 조회합니다.
   *
   * 수동 요청에서 반환된 claimId와 비교하면 실행이 너무 빠르게 완료되어
   * running 상태를 놓친 경우에도 해당 Claim의 terminal 상태를 판정할 수 있습니다.
   */
  const latestRecommendationExecutionQuery = supabase
    .from("related_note_recommendation_execution_claims")
    .select("id, status")
    .eq("note_id", parsedNoteId.data)
    .eq("source_updated_at", sourceNote.updated_at)
    .order("claimed_at", { ascending: false })
    .limit(1);

  const [relatedNotesResult, latestRecommendationExecutionResult] =
    await Promise.all([relatedNotesQuery, latestRecommendationExecutionQuery]);

  const {
    hasFailedRecommendationExecution,
    hasRunningRecommendationExecution,
    latestRecommendationExecution,
  } = await resolveRecommendationExecutionUiState(
    latestRecommendationExecutionResult,
    parsedNoteId.data,
    user.id,
  );

  const { data, error } = relatedNotesResult;

  if (error) {
    await reportRelatedNotesOperationalError({
      actorUserId: user.id,
      error,
      errorCode:
        RELATED_NOTES_OPERATIONAL_ERROR_CODES.RELATED_NOTES_LOAD_FAILED,
      message: "Related Notes 목록 조회에 실패했습니다.",
      operation: RELATED_NOTES_OPERATIONAL_ERROR_OPERATIONS.LOAD_RELATED_NOTES,
      context: {
        noteId: parsedNoteId.data,
      },
      userId: user.id,
    });

    return {
      hasFailedRecommendationExecution,
      hasRunningRecommendationExecution,
      latestRecommendationExecution,
      recommendationQuota,
      relatedNotes: [],
    };
  }

  const parsed = z.array(relatedNoteRowSchema).safeParse(data);

  if (!parsed.success) {
    logError({
      message: "[getRelatedNotes] 관련 노트 파싱 실패",
      error: parsed.error,
    });

    return {
      hasFailedRecommendationExecution,
      hasRunningRecommendationExecution,
      latestRecommendationExecution,
      recommendationQuota,
      relatedNotes: [],
    };
  }

  return {
    hasFailedRecommendationExecution,
    hasRunningRecommendationExecution,
    latestRecommendationExecution,
    recommendationQuota,
    relatedNotes: parsed.data.map((row): RelatedNoteRecommendation => {
      const relatedNoteId = resolveOtherRelatedNoteId(row, parsedNoteId.data);

      const relatedNote =
        relatedNoteId === row.related_note_id
          ? {
              id: row.related_note_id,
              title: row.related_note.title,
            }
          : {
              id: row.note_id,
              title: row.source_note.title,
            };

      if (row.origin === "ai") {
        return {
          ...row.metadata,
          noteId: relatedNote.id,
          origin: "ai",
          relationId: row.id,
          title: relatedNote.title,
        };
      }

      return {
        ...(row.metadata.reason !== undefined
          ? { reason: row.metadata.reason }
          : {}),
        noteId: relatedNote.id,
        origin: "manual",
        relationId: row.id,
        title: relatedNote.title,
      };
    }),
  };
}

/**
 * 가장 최근 Related Notes AI 추천 execution claim을 polling/UI 상태로 변환합니다.
 *
 * 실행 상태 조회 자체가 실패하거나 예상하지 못한 응답을 받은 경우에는
 * Related Notes 목록 조회에 영향을 주지 않고 실행 상태만 없는 것으로 처리합니다.
 *
 * Claim ID도 함께 반환하여 Client가 특정 수동 요청의 실행 완료 여부를
 * 정확하게 추적할 수 있도록 합니다.
 *
 * @param result latest recommendation execution claim 조회 결과
 * @returns 가장 최근 AI 추천 execution과 running/failed UI 상태
 */
async function resolveRecommendationExecutionUiState(
  result: {
    data?: unknown;
    error?: unknown;
  },
  noteId: string,
  userId: string,
): Promise<RelatedNoteRecommendationExecutionUiState> {
  if (result.error) {
    await reportRelatedNotesOperationalError({
      actorUserId: userId,
      error: result.error,
      errorCode:
        RELATED_NOTES_OPERATIONAL_ERROR_CODES.RECOMMENDATION_EXECUTION_STATE_LOAD_FAILED,
      message: "Related Notes AI 추천 실행 상태 조회에 실패했습니다.",
      operation:
        RELATED_NOTES_OPERATIONAL_ERROR_OPERATIONS.LOAD_RECOMMENDATION_EXECUTION_STATE,
      context: {
        noteId,
      },
      userId,
    });

    return {
      hasFailedRecommendationExecution: false,
      hasRunningRecommendationExecution: false,
      latestRecommendationExecution: null,
    };
  }

  const parsed = z
    .array(
      z.object({
        id: z.string().uuid(),
        status: z.enum(["running", "succeeded", "failed", "stale"]),
      }),
    )
    .safeParse(result.data);

  if (!parsed.success) {
    logError({
      message: "[getRelatedNotes] AI 추천 실행 상태 파싱 실패",
      error: parsed.error,
    });

    return {
      hasFailedRecommendationExecution: false,
      hasRunningRecommendationExecution: false,
      latestRecommendationExecution: null,
    };
  }

  const latestExecution = parsed.data[0] ?? null;

  return {
    hasFailedRecommendationExecution: latestExecution?.status === "failed",
    hasRunningRecommendationExecution: latestExecution?.status === "running",
    latestRecommendationExecution: latestExecution,
  };
}

/**
 * 특정 Related Notes AI 추천 execution Claim의 현재 상태를 조회합니다.
 *
 * 이 조회는 현재 Note version의 최신 Claim을 찾기 위한 용도가 아니라,
 * Client가 이미 추적을 시작한 특정 Claim ID의 lifecycle을 확인하기 위한 용도입니다.
 *
 * 따라서 `source_updated_at`으로 필터링하지 않습니다.
 * 추천 실행 중 Note가 수정되어 현재 version이 바뀌더라도
 * 기존 Claim의 running/succeeded/failed/stale 상태를 계속 추적할 수 있습니다.
 *
 * 조회 전에 DB 시간 기준 stale cleanup을 수행하여
 * process 종료 등으로 남은 orphan running Claim도 terminal 상태로 복구합니다.
 *
 * Claim이 존재하지 않는 경우에는 null을 반환하며,
 * Claim 상태를 정상적으로 판정할 수 없는 조회/파싱 실패는 오류로 처리합니다.
 *
 * @param noteId Claim이 속한 기준 Note ID
 * @param claimId 추적할 execution Claim ID
 * @returns 지정한 Claim 상태. 존재하지 않으면 null
 */
export async function getRelatedNoteRecommendationExecutionClaim(
  noteId: string,
  claimId: string,
): Promise<RelatedNoteRecommendationExecutionClaim | null> {
  const parsedNoteId = z.string().uuid().safeParse(noteId);
  const parsedClaimId = z.string().uuid().safeParse(claimId);

  if (!parsedNoteId.success || !parsedClaimId.success) {
    return null;
  }

  const supabase = await createServerComponentClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  await requireCurrentLegalAcceptance(
    user.id,
    getNoteDetailRoute(parsedNoteId.data),
  );

  /*
   * Claim 자체를 직접 조회하기 전에 기준 Note의 소유권을 확인합니다.
   *
   * execution claim에는 user_id가 존재하지만,
   * Related Notes 조회 계약은 현재 사용자가 소유한 Note를 기준으로 하므로
   * 기존 getRelatedNotes와 동일한 권한 경계를 유지합니다.
   */
  const { data: sourceNote, error: sourceNoteError } = await supabase
    .from("notes")
    .select("id")
    .eq("id", parsedNoteId.data)
    .eq("user_id", user.id)
    .maybeSingle();

  if (sourceNoteError) {
    await reportRelatedNotesOperationalError({
      actorUserId: user.id,
      error: sourceNoteError,
      errorCode: RELATED_NOTES_OPERATIONAL_ERROR_CODES.SOURCE_NOTE_LOAD_FAILED,
      message:
        "Related Notes AI 추천 실행 조회를 위한 기준 Note 조회에 실패했습니다.",
      operation: RELATED_NOTES_OPERATIONAL_ERROR_OPERATIONS.LOAD_SOURCE_NOTE,
      context: {
        claimId: parsedClaimId.data,
        noteId: parsedNoteId.data,
      },
      userId: user.id,
    });

    throw sourceNoteError;
  }

  if (!sourceNote) {
    return null;
  }

  /*
   * background 실행이 중단되어 running Claim만 남은 경우를
   * polling 경로에서도 복구할 수 있도록 DB stale cleanup을 먼저 수행합니다.
   *
   * cleanup은 실행 상태 복구를 위한 best-effort 처리입니다.
   * cleanup 자체가 실패하더라도 Claim 상태 조회까지 막지는 않고,
   * 운영 오류를 기록한 뒤 현재 DB 상태를 그대로 조회합니다.
   */
  const { error: staleCleanupError } = await supabase.rpc(
    "cleanup_related_note_recommendation_stale_execution_claims",
    {
      p_note_id: parsedNoteId.data,
    },
  );

  if (staleCleanupError) {
    await reportRelatedNotesOperationalError({
      actorUserId: user.id,
      error: staleCleanupError,
      errorCode:
        RELATED_NOTES_OPERATIONAL_ERROR_CODES.RECOMMENDATION_EXECUTION_STATE_LOAD_FAILED,
      message: "Related Notes AI 추천 만료 실행 상태 정리에 실패했습니다.",
      operation:
        RELATED_NOTES_OPERATIONAL_ERROR_OPERATIONS.LOAD_RECOMMENDATION_EXECUTION_STATE,
      context: {
        claimId: parsedClaimId.data,
        noteId: parsedNoteId.data,
      },
      userId: user.id,
    });
  }

  const { data, error } = await supabase
    .from("related_note_recommendation_execution_claims")
    .select("id, status")
    .eq("id", parsedClaimId.data)
    .eq("note_id", parsedNoteId.data)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    await reportRelatedNotesOperationalError({
      actorUserId: user.id,
      error,
      errorCode:
        RELATED_NOTES_OPERATIONAL_ERROR_CODES.RECOMMENDATION_EXECUTION_STATE_LOAD_FAILED,
      message: "Related Notes AI 추천 실행 상태 조회에 실패했습니다.",
      operation:
        RELATED_NOTES_OPERATIONAL_ERROR_OPERATIONS.LOAD_RECOMMENDATION_EXECUTION_STATE,
      context: {
        claimId: parsedClaimId.data,
        noteId: parsedNoteId.data,
      },
      userId: user.id,
    });

    throw error;
  }

  if (!data) {
    return null;
  }

  const parsed = z
    .object({
      id: z.string().uuid(),
      status: z.enum(["running", "succeeded", "failed", "stale"]),
    })
    .safeParse(data);

  if (!parsed.success) {
    logError({
      message:
        "[getRelatedNoteRecommendationExecutionClaim] AI 추천 실행 상태 파싱 실패",
      error: parsed.error,
    });

    throw parsed.error;
  }

  return parsed.data;
}

/**
 * Related Note로 직접 연결할 수 있는 후보 Note 목록을 조회합니다.
 *
 * 실제 조회 대상은 `notes` 테이블이므로 데이터 소유 관점에서는
 * Notes query에 가까운 책임입니다.
 *
 * 다만 이 조회는 일반적인 Note 목록 조회가 아니라
 * "현재 Note에 수동으로 연결할 Related Note 선택"이라는
 * Related Notes 전용 사용 사례에 종속됩니다.
 *
 * 특히 일반 Note 목록과 달리 다음 Note를 후보에서 제외해야 합니다.
 *
 * - 현재 보고 있는 Note 자신
 * - 이미 사용자가 직접 연결한 manual 관계
 * - 현재 표시 중인 active AI 추천
 * - 사용자가 거부한 dismissed AI 추천
 *
 * 이러한 Related Notes 전용 규칙을 일반 Notes 조회 API에 섞지 않기 위해
 * 의도적으로 Related Notes query 계층에서 관리합니다.
 *
 * @param noteId Related Note를 추가할 기준 Note ID
 * @param page 조회할 페이지
 * @param search Note 제목 검색어
 * @param pageSize 페이지당 후보 수
 * @returns Related Note 후보 목록과 전체 후보 수
 */
export async function getRelatedNoteCandidates(
  noteId: string,
  page = 1,
  search = "",
  pageSize = 6,
): Promise<{
  notes: Array<{
    id: string;
    title: string;
  }>;
  total: number;
}> {
  const parsedNoteId = z.string().uuid().safeParse(noteId);

  if (!parsedNoteId.success) {
    return {
      notes: [],
      total: 0,
    };
  }

  const supabase = await createServerComponentClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      notes: [],
      total: 0,
    };
  }

  await requireCurrentLegalAcceptance(
    user.id,
    getNoteDetailRoute(parsedNoteId.data),
  );

  const { data: sourceNote, error: sourceNoteError } = await supabase
    .from("notes")
    .select("id")
    .eq("id", parsedNoteId.data)
    .eq("user_id", user.id)
    .maybeSingle();

  if (sourceNoteError) {
    await reportRelatedNotesOperationalError({
      actorUserId: user.id,
      error: sourceNoteError,
      errorCode: RELATED_NOTES_OPERATIONAL_ERROR_CODES.SOURCE_NOTE_LOAD_FAILED,
      message: "Related Note 후보 조회를 위한 기준 Note 조회에 실패했습니다.",
      operation: RELATED_NOTES_OPERATIONAL_ERROR_OPERATIONS.LOAD_SOURCE_NOTE,
      context: {
        noteId: parsedNoteId.data,
      },
      userId: user.id,
    });

    throw sourceNoteError;
  }

  if (!sourceNote) {
    return {
      notes: [],
      total: 0,
    };
  }

  const { data: existingRelations, error: relationError } = await supabase
    .from("note_related_notes")
    .select("note_id, related_note_id")
    .or(
      `note_id.eq.${parsedNoteId.data},related_note_id.eq.${parsedNoteId.data}`,
    );

  if (relationError) {
    await reportRelatedNotesOperationalError({
      actorUserId: user.id,
      error: relationError,
      errorCode:
        RELATED_NOTES_OPERATIONAL_ERROR_CODES.RELATED_NOTES_LOAD_FAILED,
      message: "Related Note 후보 제외를 위한 기존 관계 조회에 실패했습니다.",
      operation: RELATED_NOTES_OPERATIONAL_ERROR_OPERATIONS.LOAD_RELATED_NOTES,
      context: {
        noteId: parsedNoteId.data,
      },
      userId: user.id,
    });

    throw relationError;
  }

  const excludedNoteIds = [
    parsedNoteId.data,
    ...(existingRelations ?? []).map((relation) =>
      resolveOtherRelatedNoteId(relation, parsedNoteId.data),
    ),
  ];

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("notes")
    .select("id, title", { count: "exact" })
    .eq("user_id", user.id)
    .not("id", "in", `(${excludedNoteIds.join(",")})`)
    .order("updated_at", { ascending: false });

  if (search.trim()) {
    const term = escapePostgrestLikePattern(search.trim()).replace(/"/g, '\\"');

    query = query.ilike("title", `%${term}%`);
  }

  const { data, count, error } = await query.range(from, to);

  if (error) {
    await reportRelatedNotesOperationalError({
      actorUserId: user.id,
      error,
      errorCode:
        RELATED_NOTES_OPERATIONAL_ERROR_CODES.RELATED_NOTE_CANDIDATES_LOAD_FAILED,
      message: "Related Note 후보 목록 조회에 실패했습니다.",
      operation:
        RELATED_NOTES_OPERATIONAL_ERROR_OPERATIONS.LOAD_RELATED_NOTE_CANDIDATES,
      context: {
        noteId: parsedNoteId.data,
        page,
        pageSize,
        searchApplied: search.trim().length > 0,
      },
      userId: user.id,
    });

    throw error;
  }

  const parsed = z
    .array(
      z.object({
        id: z.string().uuid(),
        title: z.string(),
      }),
    )
    .safeParse(data);

  if (!parsed.success) {
    logError({
      message: "[getRelatedNoteCandidates] 후보 Note 파싱 실패",
      error: parsed.error,
    });

    return {
      notes: [],
      total: 0,
    };
  }

  return {
    notes: parsed.data,
    total: count ?? 0,
  };
}
