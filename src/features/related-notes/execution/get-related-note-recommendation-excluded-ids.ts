import {
  RELATED_NOTES_OPERATIONAL_ERROR_CODES,
  RELATED_NOTES_OPERATIONAL_ERROR_OPERATIONS,
} from "@/features/operational-errors/constants";
import { createAdminClient } from "@/lib/supabase/admin";

import { reportRelatedNotesOperationalError } from "../utils/report-operational-error";
import { resolveOtherRelatedNoteId } from "../utils/resolve-other-related-note-id";

type GetRelatedNoteRecommendationExcludedIdsParams = {
  /** AI 관련 노트를 추천할 기준 Note ID입니다. */
  noteId: string;

  /** 추천 대상 Note의 소유 사용자 ID입니다. */
  ownerUserId: string;
};

/**
 * AI Related Notes 재추천 검색에서 제외할 기존 Related Note ID를 조회합니다.
 *
 * 사용자가 직접 연결한 manual 관계는 AI 추천으로 다시 제안하지 않으며,
 * 사용자가 명시적으로 거부한 dismissed AI 관계도 다시 추천하지 않습니다.
 *
 * 기존 active AI 관계는 현재 Note 내용을 기준으로 다시 평가할 수 있어야 하므로
 * 제외 대상에 포함하지 않습니다.
 *
 * 현재 기준 Note 자신은 이 함수에서 포함하지 않습니다.
 * 자기 자신 제외는 Related Notes 검색 Context를 준비하는 단계에서
 * 별도로 적용합니다.
 *
 * service role client를 사용하므로 기준 Note가 ownerUserId 소유인지
 * 명시적으로 확인한 뒤 기존 관계를 조회합니다.
 *
 * @param params AI 재추천 제외 대상을 조회할 기준 Note 정보
 * @returns AI 재추천 검색에서 제외할 Related Note ID 목록
 */
export async function getRelatedNoteRecommendationExcludedIds({
  noteId,
  ownerUserId,
}: GetRelatedNoteRecommendationExcludedIdsParams): Promise<string[]> {
  /*
   * AI 추천은 요청 응답 이후의 후처리에서도 실행되므로,
   * 요청 쿠키/RLS 컨텍스트에 의존하지 않도록 service role client를 사용합니다.
   */
  const supabase = createAdminClient();

  /*
   * service role client는 RLS를 우회하므로 기준 Note가 실제로
   * 전달받은 ownerUserId의 소유인지 명시적으로 확인합니다.
   */
  const { data: sourceNote, error: sourceNoteError } = await supabase
    .from("notes")
    .select("id")
    .eq("id", noteId)
    .eq("user_id", ownerUserId)
    .maybeSingle();

  if (sourceNoteError) {
    await reportRelatedNotesOperationalError({
      error: sourceNoteError,
      errorCode:
        RELATED_NOTES_OPERATIONAL_ERROR_CODES.RECOMMENDATION_EXCLUSIONS_LOAD_FAILED,
      message: "Related Note 추천 제외 대상 조회에 실패했습니다.",
      operation:
        RELATED_NOTES_OPERATIONAL_ERROR_OPERATIONS.LOAD_RECOMMENDATION_EXCLUSIONS,
      context: {
        noteId,
      },
      userId: ownerUserId,
    });

    throw sourceNoteError;
  }

  /*
   * Note가 존재하지 않거나 전달받은 사용자 소유가 아니라면
   * service role 권한으로 관계를 추가 조회하지 않고 종료합니다.
   */
  if (!sourceNote) {
    return [];
  }

  /*
   * manual 관계와 dismissed AI 관계만 재추천 후보에서 제외합니다.
   * active AI 관계는 현재 Note 내용을 기준으로 다시 평가할 수 있도록 유지합니다.
   * 관계 저장 방향과 관계없이 현재 기준 Note의 반대편 Note ID를 제외합니다.
   */
  const { data, error } = await supabase
    .from("note_related_notes")
    .select("note_id, related_note_id")
    .or(`note_id.eq.${noteId},related_note_id.eq.${noteId}`)
    .or("origin.eq.manual,and(origin.eq.ai,status.eq.dismissed)");

  if (error) {
    await reportRelatedNotesOperationalError({
      error,
      errorCode:
        RELATED_NOTES_OPERATIONAL_ERROR_CODES.RECOMMENDATION_EXCLUSIONS_LOAD_FAILED,
      message: "Related Note 추천 제외 대상 조회에 실패했습니다.",
      operation:
        RELATED_NOTES_OPERATIONAL_ERROR_OPERATIONS.LOAD_RECOMMENDATION_EXCLUSIONS,
      context: {
        noteId,
      },
      userId: ownerUserId,
    });

    throw error;
  }

  return (data ?? []).map((relation) =>
    resolveOtherRelatedNoteId(relation, noteId),
  );
}
