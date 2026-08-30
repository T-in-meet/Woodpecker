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

import { RELATED_NOTES_DAILY_RECOMMENDATION_LIMIT_PER_NOTE } from "./constants/ai";
import { relatedNoteRowSchema } from "./schemas";
import type { RelatedNoteRecommendation } from "./types";
import { reportRelatedNotesOperationalError } from "./utils/report-operational-error";
import { resolveOtherRelatedNoteId } from "./utils/resolve-other-related-note-id";

/** Related Notes 섹션 조회 결과입니다. */
export type RelatedNotesQueryResult = {
  /** 현재 표시할 Related Notes 목록입니다. */
  relatedNotes: RelatedNoteRecommendation[];

  /** 현재 Note에 대해 AI 추천 실행이 진행 중인지 여부입니다. */
  hasRunningRecommendationExecution: boolean;

  /** 현재 Note의 가장 최근 AI 추천 실행이 실패했는지 여부입니다. */
  hasFailedRecommendationExecution: boolean;

  /**
   * 현재 Note의 오늘 AI 추천 사용량입니다.
   *
   * 일일 실행 제한을 적용받는 일반 사용자에게만 반환하며,
   * quota를 우회하는 ADMIN에게는 null을 반환합니다.
   */
  recommendationUsage: {
    used: number;
    limit: number;
  } | null;
};

/** Related Notes AI 추천 실행의 UI 상태입니다. */
type RelatedNoteRecommendationExecutionUiState = {
  /** 가장 최근 AI 추천 실행이 진행 중인지 여부입니다. */
  hasRunningRecommendationExecution: boolean;

  /** 가장 최근 AI 추천 실행이 실패했는지 여부입니다. */
  hasFailedRecommendationExecution: boolean;
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
  /*
   * 이 함수는 Client Component에서 Server Action으로 호출될 수 있으므로
   * Client가 전달한 noteId를 그대로 신뢰하지 않습니다.
   *
   * PostgREST filter 문자열에 삽입하기 전에 UUID 형식을 검증하여
   * 예약 문자를 통한 필터 표현식 확장을 방지합니다.
   */
  const parsedNoteId = z.string().uuid().safeParse(noteId);

  if (!parsedNoteId.success) {
    return {
      hasFailedRecommendationExecution: false,
      hasRunningRecommendationExecution: false,
      recommendationUsage: null,
      relatedNotes: [],
    };
  }

  const supabase = await createServerComponentClient();

  /*
   * 이 함수는 Client Component에서 Server Action으로 호출될 수 있으므로
   * (main) layout의 재동의 게이트를 거치지 않을 수 있습니다.
   * 조회 전 인증 사용자와 최신 법적 문서 동의 여부를 직접 확인합니다.
   */
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      hasFailedRecommendationExecution: false,
      hasRunningRecommendationExecution: false,
      recommendationUsage: null,
      relatedNotes: [],
    };
  }

  await requireCurrentLegalAcceptance(
    user.id,
    getNoteDetailRoute(parsedNoteId.data),
  );

  /*
   * AI 추천 execution claim은 Note의 source_updated_at 단위로 관리됩니다.
   *
   * 이전 Note version의 failed/running claim이 현재 Note의 UI 상태에
   * 영향을 주지 않도록 현재 Note의 updated_at을 먼저 조회합니다.
   *
   * 일일 사용량은 quota를 적용받는 일반 사용자에게만 표시하므로,
   * 동일한 시점에 현재 사용자의 role도 함께 조회합니다.
   */
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
    /*
     * 기준 Note 조회 실패는 현재 Note version을 확정할 수 없어
     * Related Notes 조회 기능 일부를 수행할 수 없는 DB operational error입니다.
     */
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
      recommendationUsage: null,
      relatedNotes: [],
    };
  }

  if (!sourceNote) {
    return {
      hasFailedRecommendationExecution: false,
      hasRunningRecommendationExecution: false,
      recommendationUsage: null,
      relatedNotes: [],
    };
  }

  const { data: profile, error: profileError } = profileResult;

  /*
   * role 조회 실패는 Related Notes 목록 자체를 조회할 수 없는 오류가 아닙니다.
   *
   * 다만 ADMIN에게 유한한 일일 제한이 있는 것처럼 표시하면 안 되므로,
   * role을 확정할 수 없는 경우에는 usage RPC를 호출하지 않고
   * 사용량을 표시하지 않습니다.
   *
   * 화면 기능 자체는 계속 제공하되 관리자가 실패 원인을 확인할 수 있도록
   * structured operational error로 기록합니다.
   */
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

  const shouldQueryRecommendationUsage =
    !profileError && profile?.role === "USER";

  /*
   * 화면 표시 목록과 AI 추천 실행 상태, 일일 사용량은 서로 독립적인 조회입니다.
   * 같은 인증된 Supabase client를 사용하되 병렬로 실행해 페이지 진입 지연을 줄입니다.
   *
   * 실행 상태와 일일 사용량은 운영 이력인 recommendation_runs가 아니라
   * 기능 제어의 정본인 recommendation_execution_claims를 기준으로 판단합니다.
   *
   * 실행 상태는 현재 Note version과 동일한 source_updated_at의 claim만 대상으로 하며,
   * failed claim은 재시도 이후에도 이력으로 남을 수 있으므로
   * 특정 status의 존재 여부가 아니라 가장 최근 claim의 status를 조회합니다.
   *
   * 일일 사용량은 일반 사용자에게만 필요하므로 USER인 경우에만 RPC를 호출합니다.
   * ADMIN은 Claim RPC에서 일일 quota를 우회하므로 usage RPC도 호출하지 않습니다.
   */
  const relatedNotesQuery = supabase
    .from("note_related_notes")
    .select(
      "note_id, related_note_id, origin, metadata, source_note:notes!note_related_notes_note_id_fkey(title), related_note:notes!note_related_notes_related_note_id_fkey(title)",
    )
    .eq("status", "active")
    .or(
      `note_id.eq.${parsedNoteId.data},related_note_id.eq.${parsedNoteId.data}`,
    )
    .order("created_at", { ascending: true });

  const latestRecommendationExecutionQuery = supabase
    .from("related_note_recommendation_execution_claims")
    .select("status")
    .eq("note_id", parsedNoteId.data)
    .eq("source_updated_at", sourceNote.updated_at)
    .order("claimed_at", { ascending: false })
    .limit(1);

  const recommendationUsageQuery = shouldQueryRecommendationUsage
    ? supabase.rpc("get_related_note_recommendation_daily_usage", {
        p_note_id: parsedNoteId.data,
      })
    : Promise.resolve({
        data: null,
        error: null,
      });

  const [
    relatedNotesResult,
    latestRecommendationExecutionResult,
    recommendationUsageResult,
  ] = await Promise.all([
    relatedNotesQuery,
    latestRecommendationExecutionQuery,
    recommendationUsageQuery,
  ]);

  const {
    hasFailedRecommendationExecution,
    hasRunningRecommendationExecution,
  } = await resolveRecommendationExecutionUiState(
    latestRecommendationExecutionResult,
    parsedNoteId.data,
    user.id,
  );

  /*
   * usage 조회 실패는 Related Notes 목록이나 실행 상태 조회에 영향을 주지 않습니다.
   *
   * 일일 사용량을 확정할 수 없는 경우에는 잘못된 quota 정보를 표시하지 않도록
   * recommendationUsage를 null로 유지합니다.
   *
   * DB/RPC 조회 실패는 화면에서는 best-effort로 처리하되,
   * 관리자가 원인을 확인할 수 있도록 structured operational error로 기록합니다.
   */
  let recommendationUsage: RelatedNotesQueryResult["recommendationUsage"] =
    null;

  if (shouldQueryRecommendationUsage) {
    if (recommendationUsageResult.error) {
      await reportRelatedNotesOperationalError({
        actorUserId: user.id,
        error: recommendationUsageResult.error,
        errorCode:
          RELATED_NOTES_OPERATIONAL_ERROR_CODES.DAILY_USAGE_LOAD_FAILED,
        message: "Related Notes 일일 AI 추천 사용량 조회에 실패했습니다.",
        operation: RELATED_NOTES_OPERATIONAL_ERROR_OPERATIONS.GET_DAILY_USAGE,
        userId: user.id,
      });
    } else {
      const parsedRecommendationUsage = z
        .number()
        .int()
        .nonnegative()
        .safeParse(recommendationUsageResult.data);

      if (!parsedRecommendationUsage.success) {
        logError({
          message: "[getRelatedNotes] AI 추천 일일 사용량 파싱 실패",
          error: parsedRecommendationUsage.error,
        });
      } else {
        recommendationUsage = {
          used: parsedRecommendationUsage.data,
          limit: RELATED_NOTES_DAILY_RECOMMENDATION_LIMIT_PER_NOTE,
        };
      }
    }
  }

  const { data, error } = relatedNotesResult;

  if (error) {
    /*
     * Related Notes 목록 DB 조회 실패는 섹션의 핵심 데이터를 로드하지
     * 못한 경우이므로 operational error로 남기고 기존처럼 빈 목록을 반환합니다.
     */
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
      recommendationUsage,
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
      recommendationUsage,
      relatedNotes: [],
    };
  }

  return {
    hasFailedRecommendationExecution,
    hasRunningRecommendationExecution,
    recommendationUsage,
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
          noteId: relatedNote.id,
          origin: "ai",
          ...row.metadata,
          title: relatedNote.title,
        };
      }

      return {
        noteId: relatedNote.id,
        origin: "manual",
        title: relatedNote.title,
        ...(row.metadata.reason !== undefined
          ? { reason: row.metadata.reason }
          : {}),
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
 * @param result latest recommendation execution claim 조회 결과
 * @returns 가장 최근 AI 추천 실행의 running/failed UI 상태
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
    /*
     * 실행 상태는 best-effort UI 정보지만 DB 조회 자체가 실패한 경우이므로
     * 관리자 추적이 가능하도록 operational error로 기록합니다.
     */
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
    };
  }

  const parsed = z
    .array(
      z.object({
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
    };
  }

  const latestExecution = parsed.data[0];

  return {
    hasFailedRecommendationExecution: latestExecution?.status === "failed",
    hasRunningRecommendationExecution: latestExecution?.status === "running",
  };
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
  /*
   * 이 함수는 Client Component에서 Server Action으로 호출될 수 있으므로
   * Client가 전달한 noteId를 그대로 신뢰하지 않습니다.
   *
   * 형식이 잘못된 ID는 DB 조회를 수행하지 않고 빈 후보 목록으로 처리합니다.
   */
  const parsedNoteId = z.string().uuid().safeParse(noteId);

  if (!parsedNoteId.success) {
    return {
      notes: [],
      total: 0,
    };
  }

  const supabase = await createServerComponentClient();

  /*
   * userId는 Client에서 전달받지 않고 서버의 인증 세션에서 직접 확인합니다.
   *
   * 이를 통해 다른 사용자의 userId를 임의로 전달하여
   * 해당 사용자의 Note 목록을 조회하는 것을 방지합니다.
   */
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

  /*
   * 기준 Note가 실제로 현재 사용자의 Note인지 확인합니다.
   *
   * 이후 후보 목록 자체도 user.id로 제한하지만,
   * 다른 사용자의 noteId를 기준 Note로 전달하는 요청 자체를 허용하지 않기 위해
   * 먼저 소유권을 확인합니다.
   */
  const { data: sourceNote, error: sourceNoteError } = await supabase
    .from("notes")
    .select("id")
    .eq("id", parsedNoteId.data)
    .eq("user_id", user.id)
    .maybeSingle();

  if (sourceNoteError) {
    /*
     * 기준 Note 소유권 확인 DB 호출이 실패하면 후보 조회를 안전하게 계속할 수
     * 없으므로 operational error로 기록하고 기존 throw 정책을 유지합니다.
     */
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

  /*
   * 이미 관계가 존재하는 Note ID를 먼저 조회합니다.
   *
   * 수동 추가 Dialog에서는 관계의 origin/status와 관계없이
   * 이미 관계가 존재하는 Note를 다시 선택할 수 없도록 합니다.
   *
   * 따라서 다음 관계가 모두 제외 대상입니다.
   *
   * - manual + active
   * - ai + active
   * - ai + dismissed
   *
   * AI 재추천에서는 active AI 관계를 다시 평가할 수 있지만,
   * 이 함수는 "수동 추가 후보"를 조회하는 함수이므로 정책이 다릅니다.
   */
  const { data: existingRelations, error: relationError } = await supabase
    .from("note_related_notes")
    .select("note_id, related_note_id")
    .or(
      `note_id.eq.${parsedNoteId.data},related_note_id.eq.${parsedNoteId.data}`,
    );

  if (relationError) {
    /*
     * 기존 관계 조회 실패는 제외 목록을 구성할 수 없어 후보 결과가 틀릴 수
     * 있으므로 operational error로 기록하고 기존 throw 정책을 유지합니다.
     */
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

  /*
   * 현재 Note 자신도 Related Note로 연결할 수 없으므로 제외합니다.
   *
   * 이후 notes 조회에서 한 번에 제외할 수 있도록
   * 기존 관계 ID와 현재 Note ID를 하나의 목록으로 구성합니다.
   */
  const excludedNoteIds = [
    parsedNoteId.data,
    ...(existingRelations ?? []).map((relation) =>
      resolveOtherRelatedNoteId(relation, parsedNoteId.data),
    ),
  ];

  /*
   * Supabase range는 양 끝 index를 모두 포함합니다.
   *
   * 예를 들어 pageSize가 8이면:
   * page 1 → 0 ~ 7
   * page 2 → 8 ~ 15
   */
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  /*
   * Related Note 선택에 필요한 최소 정보만 조회합니다.
   *
   * 일반 Note 목록과 달리 content, 복습 상태, 생성일 등의 정보는
   * 후보 선택에 필요하지 않으므로 id와 title만 반환합니다.
   *
   * count는 Dialog pagination의 전체 페이지 수 계산에 사용합니다.
   */
  let query = supabase
    .from("notes")
    .select("id, title", { count: "exact" })
    .eq("user_id", user.id)
    .not("id", "in", `(${excludedNoteIds.join(",")})`)
    .order("updated_at", { ascending: false });

  /*
   * 검색어가 있으면 Note 제목에 대해서만 부분 일치 검색합니다.
   *
   * `%`, `_` 등 LIKE 패턴에서 특별한 의미를 가지는 문자가
   * 사용자의 검색어 자체로 취급되도록 escape합니다.
   */
  if (search.trim()) {
    const term = escapePostgrestLikePattern(search.trim()).replace(/"/g, '\\"');

    query = query.ilike("title", `%${term}%`);
  }

  /*
   * 제외 및 검색 조건을 모두 적용한 뒤 pagination을 수행해야
   * 각 페이지의 개수와 total 값이 실제 후보 목록과 일치합니다.
   */
  const { data, count, error } = await query.range(from, to);

  if (error) {
    /*
     * 후보 Note 목록 DB 호출 실패는 Dialog 후보 목록을 제공할 수 없는
     * operational error이므로 기록한 뒤 기존 throw 정책을 유지합니다.
     */
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

  /*
   * DB 응답을 그대로 Client에 전달하지 않고 런타임에서 검증합니다.
   *
   * database.types.ts는 컴파일 타임 타입만 보장하므로,
   * 예상하지 못한 DB 응답이 들어온 경우 빈 목록으로 안전하게 처리합니다.
   */
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
