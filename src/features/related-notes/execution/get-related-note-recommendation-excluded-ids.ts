import {
  RELATED_NOTES_OPERATIONAL_ERROR_CODES,
  RELATED_NOTES_OPERATIONAL_ERROR_OPERATIONS,
} from "@/features/operational-errors/constants";
import { createServerComponentClient } from "@/lib/supabase/server";

import { reportRelatedNotesOperationalError } from "../utils/report-operational-error";

type GetRelatedNoteRecommendationExcludedIdsParams = {
  /** AI 관련 노트를 추천할 기준 Note ID입니다. */
  noteId: string;
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
 * @param params AI 재추천 제외 대상을 조회할 기준 Note 정보
 * @returns AI 재추천 검색에서 제외할 Related Note ID 목록
 */
export async function getRelatedNoteRecommendationExcludedIds({
  noteId,
}: GetRelatedNoteRecommendationExcludedIdsParams): Promise<string[]> {
  const supabase = await createServerComponentClient();

  const { data, error } = await supabase
    .from("note_related_notes")
    .select("related_note_id")
    .eq("note_id", noteId)
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
    });

    throw error;
  }

  return (data ?? []).map((relation) => relation.related_note_id);
}
