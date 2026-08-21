"use server";

import { z } from "zod";

import { logError } from "@/lib/logger";
import { createServerComponentClient } from "@/lib/supabase/server";
import { escapePostgrestLikePattern } from "@/lib/utils/escapePostgrestLikePattern";

import { relatedNoteRowSchema } from "./schemas";
import type { RelatedNoteRecommendation } from "./types";

/** Related Notes 섹션 조회 결과입니다. */
export type RelatedNotesQueryResult = {
  /** 현재 표시할 Related Notes 목록입니다. */
  relatedNotes: RelatedNoteRecommendation[];

  /** 현재 Note에 대해 AI 추천 Run이 진행 중인지 여부입니다. */
  hasRunningRecommendationRun: boolean;
};

/**
 * 지정한 Note에 현재 연결되어 있는 Related Notes를 조회합니다.
 *
 * 사용자가 직접 연결한 관계와 AI 추천 관계 중 active 상태인 관계만 반환하며,
 * 각 관계의 origin도 함께 반환합니다.
 *
 * dismissed AI 추천은 화면에 표시하지 않습니다.
 *
 * @param noteId Related Notes를 조회할 기준 Note ID
 * @returns 현재 표시할 Related Notes 목록과 AI 추천 진행 여부
 */
export async function getRelatedNotes(
  noteId: string,
): Promise<RelatedNotesQueryResult> {
  const supabase = await createServerComponentClient();

  /*
   * 화면 표시 목록과 AI 추천 Run 진행 여부는 서로 독립적인 조회입니다.
   * 같은 인증된 Supabase client를 사용하되 병렬로 실행해 페이지 진입 지연을 줄입니다.
   */
  const relatedNotesQuery = supabase
    .from("note_related_notes")
    .select(
      "related_note_id, origin, metadata, notes!note_related_notes_related_note_id_fkey(title)",
    )
    .eq("note_id", noteId)
    .eq("status", "active")
    .order("created_at", { ascending: true });

  const runningRecommendationRunQuery = supabase
    .from("related_note_recommendation_runs")
    .select("id")
    .eq("note_id", noteId)
    .eq("status", "running")
    .limit(1);

  const [relatedNotesResult, runningRecommendationRunResult] =
    await Promise.all([relatedNotesQuery, runningRecommendationRunQuery]);

  const hasRunningRecommendationRun = resolveHasRunningRecommendationRun(
    runningRecommendationRunResult,
  );

  const { data, error } = relatedNotesResult;

  if (error) {
    logError({
      message: "[getRelatedNotes] 관련 노트 조회 실패",
      error,
    });

    return {
      hasRunningRecommendationRun,
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
      hasRunningRecommendationRun,
      relatedNotes: [],
    };
  }

  return {
    hasRunningRecommendationRun,
    relatedNotes: parsed.data.map((row): RelatedNoteRecommendation => {
      if (row.origin === "ai") {
        return {
          noteId: row.related_note_id,
          origin: "ai",
          ...row.metadata,
          title: row.notes.title,
        };
      }

      return {
        noteId: row.related_note_id,
        origin: "manual",
        title: row.notes.title,
        ...(row.metadata.reason !== undefined
          ? { reason: row.metadata.reason }
          : {}),
      };
    }),
  };
}

/**
 * Related Notes AI 추천 Run 조회 결과를 polling/UI 상태로 변환합니다.
 *
 * @param result running recommendation run 조회 결과
 * @returns running Run 존재 여부
 */
function resolveHasRunningRecommendationRun(result: {
  data?: unknown;
  error?: unknown;
}): boolean {
  if (result.error) {
    logError({
      message: "[getRelatedNotes] AI 추천 진행 상태 조회 실패",
      error: result.error,
    });

    return false;
  }

  return Array.isArray(result.data) && result.data.length > 0;
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
    .select("related_note_id")
    .eq("note_id", parsedNoteId.data);

  if (relationError) {
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
    ...(existingRelations ?? []).map((relation) => relation.related_note_id),
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
